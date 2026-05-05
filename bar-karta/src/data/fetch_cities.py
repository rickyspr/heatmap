import requests
import zipfile
import io
import csv
import os

def generate_cities_file():
    # Ändrad från cities50000 till cities15000 (GeoNames har ingen fil för just 50k)
    url = "http://download.geonames.org/export/dump/cities15000.zip"
    print(f"Laddar ner data från {url}...")
    
    # Hämta filen
    response = requests.get(url)
    response.raise_for_status()
    
    print("Extraherar och bearbetar data...")
    # Läs zip-filen direkt från minnet
    with zipfile.ZipFile(io.BytesIO(response.content)) as z:
        # Filen inuti zip-arkivet heter nu cities15000.txt
        with z.open('cities15000.txt') as f:
            content = f.read().decode('utf-8')
            
    cities = []
    # Filen är tab-separerad (TSV)
    reader = csv.reader(content.splitlines(), delimiter='\t')
    
    for row in reader:
        name = row[1]
        safe_name = name.replace("'", "\\'") 
        lat = float(row[4])
        lon = float(row[5])
        population = int(row[14])
        
        # Säkerhetskontroll: Vi sparar BARA städer med minst 50 000 invånare
        if population >= 50000:
            cities.append({
                'name': safe_name,
                'lat': lat,
                'lon': lon
            })
            
    # Skapa output-filen i det önskade formatet
    script_dir = os.path.dirname(os.path.abspath(__file__))
    output_file = os.path.join(script_dir, "cities_fetched.js")
    with open(output_file, 'w', encoding='utf-8') as out:
        out.write("export const CITIES = [\n")
        for city in cities:
            out.write(f"  {{ name: '{city['name']}', lat: {city['lat']:.4f}, lon: {city['lon']:.4f} }},\n")
        out.write("];\n")
        
    print(f"Klart! {len(cities)} städer sparades framgångsrikt i '{output_file}'.")

if __name__ == "__main__":
    generate_cities_file()