from flask import Flask, request, jsonify
from flask_cors import CORS
import requests

app = Flask(__name__)
CORS(app) 

@app.route('/api/run-script', methods=['POST'])
def handle_search():
    data = request.get_json()
    search_query = data.get('query', 'bar|pub') 
    
    # Receive areaId from React (Standard is Paris area-id if nothing is sent)
    area_id = data.get('areaId', '3600071525')
    
    print(f"Fetching data for '{search_query}' in area {area_id} via OSM...")
    
    url = "http://overpass-api.de/api/interpreter"
    
    # Use the dynamic area_id in the search
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
                    
            print(f"Found {len(points_data)} results!")
            return jsonify({
                "status": "success",
                "points": points_data
            })
        else:
            return jsonify({
                "status": "error",
                "message": f"Could not fetch data. Status code: {response.status_code}"
            }), 500
            
    except requests.exceptions.Timeout:
        return jsonify({
            "status": "error",
            "message": "Overpass server took too long (Timeout)."
        }), 504

if __name__ == '__main__':
    app.run(debug=True, port=5001)