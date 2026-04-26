#!/usr/bin/env python3
"""
Build a single global `countries_cities.json` by iterating over country codes
found in a Geonames `allCountries.txt` dump and invoking the per-country
converter `geonames_import.py` for each code.

This approach streams per-country processing and avoids loading the full
database into memory at once. It still requires time and disk I/O; generating
every city for every country with no population filter will produce a very
large file (hundreds of MBs to multiple GBs).

Usage:
  python backend/scripts/build_global_geonames.py \
    --input C:\geonames\allCountries.txt \
    --admin1 C:\geonames\admin1CodesASCII.txt \
    --output src/app/data/countries_cities.json \
    --min-pop 1000

Notes:
- Use `--min-pop` to reduce size (recommended). 1000 or 5000 are practical.
- You can supply `--codes-file` (one ISO code per line) to restrict which
  countries to generate.
"""
import argparse
import subprocess
import sys
import os
from typing import Set


def scan_country_codes(input_path: str) -> Set[str]:
    codes = set()
    with open(input_path, encoding="utf-8") as f:
        for ln in f:
            if not ln.strip():
                continue
            parts = ln.split("\t")
            if len(parts) >= 9:
                code = parts[8]
                if code:
                    codes.add(code)
    return codes


def main():
    p = argparse.ArgumentParser(description="Build global countries_cities.json from Geonames")
    p.add_argument("--input", required=True, help="Path to Geonames allCountries.txt")
    p.add_argument("--admin1", required=False, help="Path to admin1CodesASCII.txt")
    p.add_argument("--output", required=True, help="Output JSON path")
    p.add_argument("--min-pop", type=int, default=0, help="Minimum population to include")
    p.add_argument("--codes-file", required=False, help="Optional file with one country code per line to limit processing")
    p.add_argument("--python", default=sys.executable, help="Python executable to run geonames_import.py")

    args = p.parse_args()

    if args.codes_file:
        if not os.path.exists(args.codes_file):
            print(f"codes-file {args.codes_file} not found", file=sys.stderr)
            sys.exit(2)
        with open(args.codes_file, encoding="utf-8") as cf:
            codes = [l.strip().upper() for l in cf if l.strip()]
    else:
        print("Scanning country codes from input (this reads the file once)...")
        codes = sorted(scan_country_codes(args.input))

    print(f"Found {len(codes)} country codes; processing sequentially...")

    script = os.path.join(os.path.dirname(__file__), "geonames_import.py")
    if not os.path.exists(script):
        print(f"geonames_import.py not found at {script}", file=sys.stderr)
        sys.exit(2)

    for i, c in enumerate(codes, start=1):
        print(f"[{i}/{len(codes)}] Processing country {c}...")
        cmd = [args.python, script, "--input", args.input, "--output", args.output, "--country", c, "--country-name", c]
        if args.admin1:
            cmd += ["--admin1", args.admin1]
        if args.min_pop:
            cmd += ["--min-pop", str(args.min_pop)]
        try:
            subprocess.check_call(cmd)
        except subprocess.CalledProcessError as e:
            print(f"geonames_import.py failed for {c}: {e}", file=sys.stderr)
            # continue processing other countries

    print(f"Global build complete — output written to {args.output}")


if __name__ == "__main__":
    main()
