import requests
url='http://127.0.0.1:8000/api/auth/register-hte/'
data={'email':'new.hte@example.com','first_name':'New','last_name':'HTE','company_name':'TestCo','company_address':'123 Test Rd','barangay':'Test','contact_person':'John','contact_phone':'09123456789'}
try:
    r=requests.post(url,json=data,timeout=10)
    print('status',r.status_code)
    try:
        print(r.json())
    except Exception:
        print(r.text)
except Exception as e:
    print('error',e)
