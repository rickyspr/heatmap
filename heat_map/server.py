from flask import Flask, request, jsonify
from flask_cors import CORS
import requests

app = Flask(__name__)
CORS(app) 

@app.route('/api/run-script', methods=['POST'])
def handle_search():
    data = request.get_json()
    search_query = data.get('query', 'bar|pub') 
    
    # Ta emot areaId från React (Standard är Paris area-id om inget skickas)
    area_id = data.get('areaId', '3600071525')
    
    print(f"Hämtar data för '{search_query}' i område {area_id} via OSM...")
    
    url = "http://overpass-api.de/api/interpreter"
    
    # Använd det dynamiska area_id:t i sökningen
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
                    
            print(f"Hittade {len(points_data)} resultat!")
            return jsonify({
                "status": "success",
                "points": points_data
            })
        else:
            return jsonify({
                "status": "error",
                "message": f"Kunde inte hämta data. Statuskod: {response.status_code}"
            }), 500
            
    except requests.exceptions.Timeout:
        return jsonify({
            "status": "error",
            "message": "Overpass-servern tog för lång tid på sig (Timeout)."
        }), 504

if __name__ == '__main__':
    app.run(debug=True, port=5001)