#!/usr/bin/env python3
"""
Convert a Geonames country dump (tab-separated) into a countries_cities.json
focused on a single country (e.g. PH). Produces a JSON file with the following
structure (for each country):

{
  "code": "PH",
  "name": "Philippines",
  "regions": [
    { "code": "01", "name": "Region Name", "cities": [ {"name":"City", "lat":..., "lon":..., "population":...} ] }
  ],
  "cities": [ ... flattened list ... ]
}

Usage:
  python backend/scripts/geonames_import.py \
    --input /path/to/PH.txt \
    --admin1 /path/to/admin1CodesASCII.txt \
    --output src/app/data/countries_cities.json \
    --country PH

You can download the country dump from Geonames: http://download.geonames.org/export/dump/PH.zip
And admin1 codes from: http://download.geonames.org/export/dump/admin1CodesASCII.txt

"""
import argparse
import json
import os
from collections import defaultdict


GEONAMES_FIELDS = (
    "geonameid",
    "name",
    "asciiname",
    "alternatenames",
    "latitude",
    "longitude",
    "feature_class",
    "feature_code",
    "country_code",
    "cc2",
    "admin1",
    "admin2",
    "admin3",
    "admin4",
    "population",
    "elevation",
    "dem",
    "timezone",
    "modification_date",
)


def load_admin1(admin1_path, country_code=None):
    """Load admin1CodesASCII.txt into a map of code->name.
    Format of lines: <country>.<admin1 code>\t<name>\t<ascii name>\t<geonameid>
    """
    mapping = {}
    if not admin1_path or not os.path.exists(admin1_path):
        return mapping
    with open(admin1_path, encoding="utf-8") as f:
        for line in f:
            parts = line.strip().split("\t")
            if not parts or len(parts) < 2:
                continue
            key = parts[0]  # e.g. PH.01
            name = parts[1]
            if country_code:
                if not key.startswith(country_code + "."):
                    continue
                admin_code = key.split(".", 1)[1]
                mapping[admin_code] = name
            else:
                mapping[key] = name
    return mapping


def parse_geonames(input_path, country_code=None, min_population=0):
    """Yield geoname records (dict) filtered by country and population."""
    with open(input_path, encoding="utf-8") as f:
        for ln in f:
            if not ln.strip():
                continue
            cols = ln.rstrip("\n").split("\t")
            # Some files may be missing trailing fields; pad to expected length
            if len(cols) < len(GEONAMES_FIELDS):
                cols += [""] * (len(GEONAMES_FIELDS) - len(cols))
            rec = dict(zip(GEONAMES_FIELDS, cols))
            if country_code and rec.get("country_code") != country_code:
                continue
            try:
                pop = int(rec.get("population") or 0)
            except ValueError:
                pop = 0
            if pop < min_population:
                continue
            yield {
                "name": rec.get("name") or rec.get("asciiname"),
                "lat": float(rec.get("latitude") or 0.0),
                "lon": float(rec.get("longitude") or 0.0),
                "population": pop,
                "admin1": rec.get("admin1") or "",
            }


def build_country(entries, admin1_map=None, max_cities_per_region=None):
    """Build the country JSON structure from parsed entries."""
    regions = defaultdict(list)
    flat_cities = []
    for e in entries:
        admin1 = e.get("admin1") or "__NO_REGION__"
        regions[admin1].append(e)
        flat_cities.append(e)

    regions_list = []
    for admin_code, cities in sorted(regions.items()):
        if max_cities_per_region:
            cities = sorted(cities, key=lambda x: x.get("population", 0), reverse=True)[:max_cities_per_region]
        region_name = admin1_map.get(admin_code, admin_code) if admin1_map else admin_code
        regions_list.append({
            "code": admin_code,
            "name": region_name,
            "cities": cities,
        })

    return {
        "regions": regions_list,
        "cities": sorted(flat_cities, key=lambda x: x.get("population", 0), reverse=True),
    }


def main():
    p = argparse.ArgumentParser(description="Import Geonames country dump to countries_cities.json")
    p.add_argument("--input", required=True, help="Path to the Geonames country dump (e.g. PH.txt)")
    p.add_argument("--admin1", required=False, help="Path to admin1CodesASCII.txt to map region codes to names")
    p.add_argument("--output", required=True, help="Output JSON path (e.g. src/app/data/countries_cities.json)")
    p.add_argument("--country", required=True, help="Country code to filter (e.g. PH)")
    p.add_argument("--min-pop", type=int, default=0, help="Minimum city population to include")
    p.add_argument("--max-per-region", type=int, default=0, help="Limit number of cities per region (0 = no limit)")
    p.add_argument("--country-name", default=None, help="Optional country name to write in the JSON")

    args = p.parse_args()

    admin_map = load_admin1(args.admin1, args.country) if args.admin1 else {}

    entries = list(parse_geonames(args.input, country_code=args.country, min_population=args.min_pop))

    country_obj = build_country(entries, admin_map, max_cities_per_region=(args.max_per_region or None))
    out = {
        "code": args.country,
        "name": args.country_name or args.country,
        "regions": country_obj["regions"],
        "cities": country_obj["cities"],
    }

    # If output exists and contains other countries, try to merge
    if os.path.exists(args.output):
        try:
            with open(args.output, encoding="utf-8") as f:
                existing = json.load(f)
        except Exception:
            existing = {"countries": []}
    else:
        existing = {"countries": []}

    # Replace or append this country
    countries = [c for c in existing.get("countries", []) if c.get("code") != args.country]
    countries.append(out)
    existing["countries"] = countries

    with open(args.output, "w", encoding="utf-8") as f:
        json.dump(existing, f, ensure_ascii=False, indent=2)

    print(f"Wrote {args.output} with country {args.country} ({len(out['cities'])} cities, {len(out['regions'])} regions)")


if __name__ == "__main__":
    main()
