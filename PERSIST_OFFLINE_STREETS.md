Server-side persistence scaffold for offline streets datasets

This project currently persists uploaded offline street JSON files to the browser's IndexedDB for offline usage.
If you prefer server-side persistence (recommended for large datasets), add an upload endpoint to your Django app and store the files on disk or in object storage.

Example Django view (add to an app's `views.py` and wire to `urls.py`):

```py
from django.views.decorators.http import require_POST
from django.views.decorators.csrf import csrf_exempt
from django.http import JsonResponse
from django.core.files.storage import default_storage
from django.core.files.base import ContentFile
import os

@csrf_exempt
@require_POST
def upload_offline_streets(request):
    # expects multipart form: file and country_code
    f = request.FILES.get('file')
    country = request.POST.get('country')
    if not f or not country:
        return JsonResponse({'ok': False, 'error': 'missing file or country'}, status=400)
    # store under media/offline_streets/{COUNTRY}.json
    dest_dir = os.path.join('offline_streets')
    path = default_storage.save(os.path.join(dest_dir, f"{country.upper()}.json"), ContentFile(f.read()))
    return JsonResponse({'ok': True, 'path': path})
```

Client-side (example fetch):

```js
const form = new FormData();
form.append('file', fileInput.files[0]);
form.append('country', countryCode);
const res = await fetch(`${API_BASE}/admin/upload_offline_streets/`, { method: 'POST', body: form });
const json = await res.json();
```

Considerations:
- Validate JSON shape on the server before accepting large files.
- For large uploads, enable streaming/file-chunking or use direct-to-s3 style uploads.
- Protect the endpoint with authentication (only admin/instructor should upload datasets).
- Serve files from a stable URL and optionally expose a list endpoint so clients can `loadOfflineStreets(url)` by fetching the file.

If you want, I can scaffold the Django view + URL and admin-only protection in this repo — tell me which app to put it in (`security` is a good candidate).