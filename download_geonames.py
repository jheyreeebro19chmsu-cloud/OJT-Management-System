#!/usr/bin/env python3
import urllib.request
import zipfile
import io
import json
from collections import defaultdict
import os

os.chdir(r'c:\CAPSTONE 1 - CODE')

url = 'http://download.geonames.org/export/dump/cities1000.zip'
print('Downloading GeoNames cities1000...')

try:
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req, timeout=30) as response:
        zip_data = response.read()
    
    print('Extracting and parsing...')
    with zipfile.ZipFile(io.BytesIO(zip_data)) as zf:
        with zf.open('cities1000.txt') as f:
            lines = f.read().decode('utf-8').split('\n')
    
    countries_dict = defaultdict(list)
    processed = 0
    
    for line in lines:
        if not line.strip():
            continue
        parts = line.split('\t')
        if len(parts) < 15:
            continue
        try:
            country_code = parts[8]
            city_name = parts[1]
            population = int(parts[14]) if parts[14] else 0
            lat = float(parts[4])
            lon = float(parts[5])
            
            # Include cities with population > 1000
            if population > 1000:
                countries_dict[country_code].append({
                    'name': city_name,
                    'population': population,
                    'lat': lat,
                    'lon': lon
                })
                processed += 1
        except Exception as e:
            pass
    
    print(f'Processed {processed} cities')
    
    # Sort cities by population and limit to top 20 per country
    for country in countries_dict:
        countries_dict[country].sort(key=lambda x: x['population'], reverse=True)
        countries_dict[country] = countries_dict[country][:20]
    
    output = {
        'countries': [
            {
                'code': cc,
                'cities': countries_dict[cc]
            }
            for cc in sorted(countries_dict.keys())
        ]
    }
    
    # Create directory if needed
    os.makedirs('src/app/data', exist_ok=True)
    
    # Write JSON
    with open('src/app/data/countries_cities.json', 'w', encoding='utf-8') as f:
        json.dump(output, f, separators=(',', ':'), ensure_ascii=False)
    
    file_size = os.path.getsize('src/app/data/countries_cities.json')
    print(f'✓ Created countries_cities.json')
    print(f'  Countries: {len(output["countries"])}')
    print(f'  File size: {file_size / 1024:.1f} KB')
    
except Exception as e:
    print(f'Error: {e}')
    import traceback
    traceback.print_exc()
