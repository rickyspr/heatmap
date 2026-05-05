from flask import Flask, request, jsonify
from flask_cors import CORS
import requests

app = Flask(__name__)
CORS(app) # Tillåter React att prata med Python

@app.route('/api/run-script', methods=['POST'])
def handle_search():
    data = request.get_json()
    # Hämta sökordet från React, standardvärde 'bar|pub' om det är tomt
    search_query = data.get('query', 'bar|pub') 
    
    print(f"Hämtar data för '{search_query}' i Paris via OSM...")
    
    url = "http://overpass-api.de/api/interpreter"
    
    # Vi sätter in sökordet dynamiskt i queryn med en f-string
    query = f"""
    [out:json][timeout:30];
    area(id:3600175905)->.searchArea;
    (
      node["amenity"~"{search_query}"](area.searchArea);
      way["amenity"~"{search_query}"](area.searchArea);
    );
    out center;
    """
    
    headers = {'User-Agent': 'MapProject/1.0'}
    response = requests.get(url, params={'data': query}, headers=headers)
    
    if response.status_code == 200:
        osm_data = response.json()
        points_data = []
        
        for element in osm_data['elements']:
            lat = element.get('lat') or element.get('center', {}).get('lat')
            lon = element.get('lon') or element.get('center', {}).get('lon')
            if lat and lon:
                points_data.append([lat, lon, 1.0])
                
        print(f"Hittade {len(points_data)} '{search_query}' i Paris!")
        
        # Vi skickar tillbaka resultatet DIREKT till React
        return jsonify({
            "status": "success",
            "points": points_data
        })
    else:
        print(f"Felkod från Overpass: {response.status_code}")
        return jsonify({
            "status": "error",
            "message": f"Kunde inte hämta data. Statuskod: {response.status_code}"
        }), 500

if __name__ == '__main__':
    app.run(debug=True, port=5001)