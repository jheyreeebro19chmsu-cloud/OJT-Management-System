"""
Create the `face-photos` Supabase storage bucket and make it public.
Requires environment variables:
  SUPABASE_URL
  SUPABASE_SERVICE_ROLE_KEY

Usage:
  python create_supabase_bucket.py
"""
import os
import sys
import requests


def main():
    supabase_url = os.environ.get('SUPABASE_URL') or os.environ.get('VITE_SUPABASE_URL')
    service_key = os.environ.get('SUPABASE_SERVICE_ROLE_KEY') or os.environ.get('SUPABASE_SERVICE_ROLE_KEY')

    if not supabase_url or not service_key:
        print('Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in environment')
        sys.exit(2)

    bucket_id = 'face-photos'
    admin_buckets = f"{supabase_url.rstrip('/')}/storage/v1/admin/buckets"
    headers = {
        'Authorization': f'Bearer {service_key}',
        'apikey': service_key,
        'Content-Type': 'application/json'
    }

    # Fetch existing buckets
    try:
        r = requests.get(admin_buckets, headers=headers, timeout=15)
        r.raise_for_status()
        buckets = r.json()
    except Exception as e:
        print('Failed to fetch buckets:', e)
        sys.exit(1)

    for b in buckets:
        if b.get('id') == bucket_id:
            print(f"Bucket '{bucket_id}' already exists.")
            print('Public URL prefix:', f"{supabase_url.rstrip('/')}/storage/v1/object/public/{bucket_id}/")
            return

    # Create bucket
    payload = {"id": bucket_id, "name": "face-photos", "public": True}
    try:
        r = requests.post(admin_buckets, json=payload, headers=headers, timeout=15)
        r.raise_for_status()
        print(f"Created bucket '{bucket_id}' and set to public.")
        print('Public URL prefix:', f"{supabase_url.rstrip('/')}/storage/v1/object/public/{bucket_id}/")
    except Exception as e:
        print('Failed to create bucket:', e)
        if hasattr(e, 'response') and e.response is not None:
            try:
                print('Response:', e.response.text)
            except Exception:
                pass
        sys.exit(1)


if __name__ == '__main__':
    main()
