import requests
import json
import os

url = "http://overpass-api.de/api/interpreter"

# We use 'id: 3600071525' which is the unique ID for Paris in OSM
# 3600000000 + OSM_RELATION_ID (71525)
query = """
[out:json][timeout:30];
area(id:3600071525)->.searchArea;
(
  node["amenity"~"bar|pub"](area.searchArea);
  way["amenity"~"bar|pub"](area.searchArea);
);
out center;
"""

print("Fetching data for Paris via OSM ID (this is safer)...")
headers = {'User-Agent': 'BarMapProject/1.0'}
response = requests.get(url, params={'data': query}, headers=headers)

if response.status_code == 200:
    data = response.json()
    bar_data = []
    
    for element in data['elements']:
        lat = element.get('lat') or element.get('center', {}).get('lat')
        lon = element.get('lon') or element.get('center', {}).get('lon')
        if lat and lon:
            bar_data.append([lat, lon, 1.0])
            
    print(f"Found {len(bar_data)} bars and pubs in Paris!")
    
    os.makedirs('public', exist_ok=True)
    with open('public/bars.json', 'w', encoding='utf-8') as f:
        json.dump(bar_data, f)
    print("Done! Check bars.json now.")
else:
    print(f"Error code: {response.status_code}")