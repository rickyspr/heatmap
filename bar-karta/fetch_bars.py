import requests
import json
import os

url = "http://overpass-api.de/api/interpreter"

# Vi använder 'id: 3600071525' vilket är det unika ID:t för Paris i OSM
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

print("Hämtar data för Paris via OSM ID (detta är säkrare)...")
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
            
    print(f"Hittade {len(bar_data)} barer och pubar i Paris!")
    
    os.makedirs('public', exist_ok=True)
    with open('public/bars.json', 'w', encoding='utf-8') as f:
        json.dump(bar_data, f)
    print("Klart! Kolla bars.json nu.")
else:
    print(f"Felkod: {response.status_code}")