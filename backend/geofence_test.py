import urllib.request
import urllib.error
import json
import time
import sys

base = 'http://127.0.0.1:8000/security'
health_url = f'{base}/health/'
check_url = f'{base}/geofence/check/'

# Wait for server up
for i in range(12):
    try:
        with urllib.request.urlopen(health_url, timeout=2) as resp:
            data = resp.read().decode('utf-8')
            print('SERVER_UP')
            print(data)
            break
    except Exception as e:
        time.sleep(1)
else:
    print('SERVER_NOT_UP')
    sys.exit(2)

payload = {
    'lat': 10.0,
    'lng': 20.0,
    'accuracy': 15,
    'zones': [
        {'name': 'Test Zone', 'lat': 10.001, 'lng': 20.001, 'radius': 200, 'active': True}
    ]
}

req = urllib.request.Request(check_url, data=json.dumps(payload).encode('utf-8'),
                             headers={'Content-Type': 'application/json'}, method='POST')
try:
    with urllib.request.urlopen(req, timeout=5) as resp:
        res = resp.read().decode('utf-8')
        print('GEOTEST_OK')
        print(res)
except urllib.error.HTTPError as e:
    print('GEOTEST_HTTP_ERROR', e.code)
    print(e.read().decode('utf-8'))
    sys.exit(3)
except Exception as e:
    print('GEOTEST_FAIL', str(e))
    sys.exit(4)
