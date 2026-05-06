import requests
import zipfile
import io
import csv
import os

def generate_cities_file():
    # Changed from cities50000 to cities15000 (GeoNames doesn't have a file for exactly 50k)
    url = "http://download.geonames.org/export/dump/cities15000.zip"
    print(f"Downloading data from {url}...")
    
    # Fetch the file
    response = requests.get(url)
    response.raise_for_status()
    
    print("Extracting and processing data...")
    # Read the zip file directly from memory
    with zipfile.ZipFile(io.BytesIO(response.content)) as z:
        # The file inside the zip archive is now named cities15000.txt
        with z.open('cities15000.txt') as f:
            content = f.read().decode('utf-8')
            
    cities = []
    # The file is tab-separated (TSV)
    reader = csv.reader(content.splitlines(), delimiter='\t')
    
    for row in reader:
        name = row[1]
        safe_name = name.replace("'", "\\'") 
        lat = float(row[4])
        lon = float(row[5])
        population = int(row[14])
        
        # Safety check: We only save cities with at least 50,000 inhabitants
        if population >= 50000:
            cities.append({
                'name': safe_name,
                'lat': lat,
                'lon': lon
            })
            
    # Create the output file in the desired format
    script_dir = os.path.dirname(os.path.abspath(__file__))
    output_file = os.path.join(script_dir, "cities_fetched.js")
    with open(output_file, 'w', encoding='utf-8') as out:
        out.write("export const CITIES = [\n")
        for city in cities:
            out.write(f"  {{ name: '{city['name']}', lat: {city['lat']:.4f}, lon: {city['lon']:.4f} }},\n")
        out.write("];\n")
        
    print(f"Done! {len(cities)} cities were successfully saved in '{output_file}'.")

if __name__ == "__main__":
    generate_cities_file()