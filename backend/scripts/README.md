Geonames import helper
======================

This folder contains a small helper to convert Geonames country dumps into the
frontend JSON structure used for offline address autocomplete.

Steps:

1. Download the Geonames country dump for the Philippines (or another country):

   - http://download.geonames.org/export/dump/PH.zip

   Unzip to get `PH.txt`.

2. (Optional) Download `admin1CodesASCII.txt` to map region/admin1 codes to names:

   - http://download.geonames.org/export/dump/admin1CodesASCII.txt

3. Run the converter:

```powershell
python backend/scripts/geonames_import.py --input C:\path\to\PH.txt \
  --admin1 C:\path\to\admin1CodesASCII.txt \
  --output src/app/data/countries_cities.json \
  --country PH --country-name "Philippines" --min-pop 1000
```

Adjust `--min-pop` or `--max-per-region` to control output size.

After running, commit `src/app/data/countries_cities.json` and redeploy the frontend.

Global build
------------

To build a single global `countries_cities.json` from a full Geonames dump, use
the `build_global_geonames.py` helper. This script will iterate country codes and
invoke `geonames_import.py` per country so the entire job does not need to be
kept in memory.

Example (PowerShell):

```powershell
python backend/scripts/build_global_geonames.py --input C:\geonames\allCountries.txt --admin1 C:\geonames\admin1CodesASCII.txt --output src/app/data/countries_cities.json --min-pop 1000
```

Caveats:

- The full global dataset is very large if you include every place (no
   `--min-pop`); expect large file sizes and slower client performance.
- Prefer generating per-country files and loading them on demand in the UI,
   or use the backend proxy approach described earlier.
- Use `--codes-file` to limit which countries are processed.

