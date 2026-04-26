#!/usr/bin/env python3
"""
Simple OSM XML -> offline streets JSON converter.

Usage:
  python scripts/osm_to_streets.py input.osm.xml output_dir/

This script looks for nodes and ways with addr:street, addr:city and addr:country (or addr:region/state/province)
and groups street names by country and city (lowercased city key). It writes one JSON file per country
into `output_dir/` with the structure:
{
  "cities": {
    "manila": ["Calle Real", "Rizal Ave", ...],
    ...
  },
  "meta": {
    "manila": { "country": "PH", "region": "NCR", "city": "Manila" }
  }
}

Notes:
- This is a best-effort extractor; OSM data varies. For large extracts prefer `osmium` tools.
- For PBF files, first convert to OSM XML (e.g. `osmium convert`).
"""
import sys
import os
import json
from collections import defaultdict
try:
    from lxml import etree
except Exception:
    print('This script requires lxml. Install with: pip install lxml')
    sys.exit(1)

TAG_NAMES = ['addr:street', 'addr:city', 'addr:country', 'addr:region', 'addr:province', 'addr:state']


def get_tags(elem):
    tags = {}
    for tag in elem.findall('tag'):
        k = tag.get('k')
        v = tag.get('v')
        if k and v:
            tags[k] = v
    return tags


def normalize_city_key(city):
    if not city:
        return ''
    return city.strip().lower()


def pick_region(tags):
    for k in ('addr:region', 'addr:province', 'addr:state'):
        if k in tags:
            return tags[k]
    return ''


def main():
    if len(sys.argv) < 3:
        print('Usage: python scripts/osm_to_streets.py input.osm.xml output_dir/')
        sys.exit(1)
    infile = sys.argv[1]
    outdir = sys.argv[2]
    if not os.path.exists(infile):
        print('Input file not found:', infile)
        sys.exit(1)
    os.makedirs(outdir, exist_ok=True)

    # structure: countries[country_code]['regions'][region_name] = set(city_names)
    # and meta: city_key -> { country, region, city }
    countries = defaultdict(lambda: {'regions': defaultdict(set), 'meta': {}})

    context = etree.iterparse(infile, events=('end',), tag=('node', 'way'))
    count = 0
    for event, elem in context:
        tags = get_tags(elem)
        street = tags.get('addr:street') or tags.get('street')
        city = tags.get('addr:city') or tags.get('city')
        country = tags.get('addr:country') or tags.get('country')
        if not street or not city or not country:
            # skip if missing required parts
            elem.clear()
            while elem.getprevious() is not None:
                del elem.getparent()[0]
            continue
        city_key = normalize_city_key(city)
        region = pick_region(tags) or 'Unknown'
        country_key = country.strip().upper() if len(country.strip()) == 2 else country.strip()

        # add city to region set
        countries[country_key]['regions'][region].add(city.strip())
        if city_key not in countries[country_key]['meta']:
            countries[country_key]['meta'][city_key] = {
                'country': country_key,
                'region': region,
                'city': city.strip()
            }

        # free memory for large files
        elem.clear()
        while elem.getprevious() is not None:
            del elem.getparent()[0]
        count += 1
        if count % 10000 == 0:
            print(f'Processed {count} elements...')

    # write per-country files
    for country_key, payload in countries.items():
        out = {
            'regions': {k: sorted(list(v)) for k, v in payload['regions'].items()},
            'meta': payload['meta']
        }
        outpath = os.path.join(outdir, f'{country_key}.json')
        with open(outpath, 'w', encoding='utf-8') as f:
            json.dump(out, f, ensure_ascii=False, indent=2)
        print('Wrote', outpath)

    print('Done. Files written:', len(countries))


if __name__ == '__main__':
    main()
