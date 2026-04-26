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
