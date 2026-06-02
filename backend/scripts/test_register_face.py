"""
Simple test script to POST a base64 image to the register_face endpoint.
Usage:
  python test_register_face.py /path/to/image.jpg [employee_id]

Requires the Django server to be running at http://localhost:8000 and will use DJANGO_SECURITY_API_KEY env var if set.
"""
import sys
import base64
import os
import requests

def main():
    if len(sys.argv) < 2:
        print('Usage: python test_register_face.py /path/to/image.jpg [employee_id]')
        return
    img_path = sys.argv[1]
    emp_id = sys.argv[2] if len(sys.argv) > 2 else 'test-employee-1'
    if not os.path.exists(img_path):
        print('Image not found:', img_path)
        return
    with open(img_path, 'rb') as f:
        data = f.read()
    b64 = 'data:image/jpeg;base64,' + base64.b64encode(data).decode('ascii')
    url = 'http://127.0.0.1:8000/api/face/register/'
    headers = {'Content-Type': 'application/json'}
    api_key = os.environ.get('DJANGO_SECURITY_API_KEY')
    if api_key:
        headers['X-OJT-API-Key'] = api_key
    payload = {'employee_id': emp_id, 'image': b64}
    r = requests.post(url, json=payload, headers=headers)
    print('Status:', r.status_code)
    try:
        print(r.json())
    except Exception:
        print(r.text)

if __name__ == '__main__':
    main()
