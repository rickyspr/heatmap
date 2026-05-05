import requests
import json
import os

# Overpass API-url
url = "http://overpass-api.de/api/interpreter"

# Fråga för att hämta barer och pubar inom Stockholms kommun
query = """
[out:json];
area["name"="Stockholms kommun"]->.searchArea;
(
  node["amenity"="bar"](area.searchArea);
  node["amenity"="pub"](area.searchArea);
);
out center;
"""

print("Hämtar data från OpenStreetMap (detta kan ta några sekunder)...")
response = requests.get(url, params={'data': query})

if response.status_code == 200:
    data = response.json()
    bar_data = []
    
    # Loopa igenom resultaten och spara latitud, longitud och en "intensitet" (1.0 för alla just nu)
    for element in data['elements']:
        lat = element.get('lat')
        lon = element.get('lon')
        if lat and lon:
            bar_data.append([lat, lon, 1.0])
            
    print(f"Hittade {len(bar_data)} barer och pubar i Stockholm!")
    
    # Spara datan i React-appens "public"-mapp så webbsidan kan komma åt den
    os.makedirs('public', exist_ok=True)
    with open('public/bars.json', 'w', encoding='utf-8') as f:
        json.dump(bar_data, f)
        
    print("Data sparad framgångsrikt till public/bars.json!")
else:
    print(f"Något gick fel vid hämtningen: Felkod {response.status_code}")