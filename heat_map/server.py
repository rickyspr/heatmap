from flask import Flask, request, jsonify
from flask_cors import CORS
import requests
import pandas as pd
import numpy as np
from sklearn.cluster import DBSCAN
import time # NY IMPORT FÖR ATT HANTERA API-BEGRÄNSNINGAR

app = Flask(__name__)
CORS(app) 

@app.route('/api/run-script', methods=['POST'])
def handle_search():
    data = request.get_json()
    search_query = data.get('query', 'bar|pub') 
    area_id = data.get('areaId', '3600071525')
    
    print(f"Hämtar data för '{search_query}' i område {area_id}...")
    url = "http://overpass-api.de/api/interpreter"
    
    query = f"""
    [out:json][timeout:90];
    area(id:{area_id})->.searchArea;
    (
      node["amenity"~"{search_query}"](area.searchArea);
      way["amenity"~"{search_query}"](area.searchArea);
    );
    out center;
    """
    headers = {'User-Agent': 'MapProject/1.0'}
    
    try:
        response = requests.get(url, params={'data': query}, headers=headers, timeout=95)
        
        if response.status_code == 200:
            osm_data = response.json()
            points_data = []
            
            for element in osm_data['elements']:
                lat = element.get('lat') or element.get('center', {}).get('lat')
                lon = element.get('lon') or element.get('center', {}).get('lon')
                if lat and lon:
                    points_data.append([lat, lon, 1])
            
            clusters_info = []
            if len(points_data) > 0:
                df = pd.DataFrame(points_data, columns=['lat', 'lon', 'weight'])
                coords = np.radians(df[['lat', 'lon']])
                
                # DBSCAN Inställningar
                epsilon_radians = (50 / 1000.0) / 6371.0 
                db = DBSCAN(eps=epsilon_radians, min_samples=5, algorithm='ball_tree', metric='haversine')
                df['cluster'] = db.fit_predict(coords)
                
                # REVERSE GEOCODING LOGIK
                unique_clusters = [c for c in df['cluster'].unique() if c != -1]
                
                for cluster_id in unique_clusters:
                    cluster_points = df[df['cluster'] == cluster_id]
                    center_lat = cluster_points['lat'].mean()
                    center_lon = cluster_points['lon'].mean()
                    
                    # Sätt ett standardnamn ifall API:et misslyckas
                    area_name = f"Område {int(cluster_id) + 1}"
                    
                    try:
                        # Nominatim tillåter max 1 request/sekund
                        time.sleep(1)
                        
                        nom_url = f"https://nominatim.openstreetmap.org/reverse?format=json&lat={center_lat}&lon={center_lon}&zoom=17"
                        nom_res = requests.get(nom_url, headers={'User-Agent': 'MapProject/1.0'}, timeout=5)
                        
                        if nom_res.status_code == 200:
                            address = nom_res.json().get('address', {})
                            # Leta efter gatunamn i första hand, sedan torg/stadsdel
                            found_name = address.get('road') or address.get('pedestrian') or address.get('square') or address.get('neighbourhood') or address.get('suburb')
                            
                            if found_name:
                                area_name = found_name
                                
                    except Exception as e:
                        print(f"Kunde inte hämta gatunamn för kluster {cluster_id}: {e}")

                    clusters_info.append({
                        'id': int(cluster_id),
                        'name': area_name,          # VÅRT NYA GATUNAMN!
                        'count': len(cluster_points),
                        'center': [center_lat, center_lon]
                    })
                
                clusters_info = sorted(clusters_info, key=lambda x: x['count'], reverse=True)

            print(f"Hittade {len(points_data)} platser och {len(clusters_info)} bargator/områden!")
            return jsonify({
                "status": "success",
                "points": points_data,     
                "clusters": clusters_info  
            })
        else:
            return jsonify({"status": "error", "message": f"Status code: {response.status_code}"}), 500
            
    except requests.exceptions.Timeout:
        return jsonify({"status": "error", "message": "Timeout."}), 504

if __name__ == '__main__':
    app.run(debug=True, port=5001)