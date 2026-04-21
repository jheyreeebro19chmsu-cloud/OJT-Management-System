# Quick Start Guide - OJT Management System

## 5-Minute Quick Start

### Prerequisites
- Python 3.10+
- Node.js 18+
- Git

### Step 1: Clone/Download Project
```bash
cd "CAPSTONE 1 - CODE"
```

### Step 2: Run Setup Script

**On Windows:**
```bash
setup.bat
```

**On Mac/Linux:**
```bash
bash setup.sh
```

### Step 3: Configure Email (Optional but Recommended)

Edit `backend/.env`:
```
EMAIL_HOST_USER=your-email@gmail.com
EMAIL_HOST_PASSWORD=your-app-specific-password
```

[Get Gmail App Password](https://support.google.com/accounts/answer/185833)

### Step 4: Start Servers

**Terminal 1 - Backend:**
```bash
cd backend
source venv/bin/activate  # Windows: venv\Scripts\activate
python manage.py runserver
```

**Terminal 2 - Frontend:**
```bash
npm run dev
```

### Step 5: Access Application

- **Frontend**: http://localhost:5173
- **Admin Panel**: http://localhost:8000/admin
- **API Documentation**: See IMPLEMENTATION_GUIDE.md

## Quick Test Flow

### 1. Register as Student
1. Go to http://localhost:5173
2. Click "Register"
3. Select "Student"
4. Enter email (check console for OTP in dev mode)
5. Verify OTP
6. Fill personal information and register

### 2. Register as Instructor
1. Go to registration
2. Select "OJT Instructor"
3. Follow verification flow
4. Receive QR code for student enrollment

### 3. Submit Application (Student)
1. Scan instructor's QR code
2. Fill application form
3. Set company location
4. Submit

### 4. Approve Application (Instructor)
1. Go to admin panel
2. View applications
3. Approve or reject
4. Student gets email notification

### 5. Track Attendance (Student)
1. Click "Time In" at company location
2. Application automatically
 captures GPS + face photo
3. Work for some time
4. Click "Time Out"
5. Hours automatically calculated

## Key URLs for Testing

| Feature | URL |
|---------|-----|
| Home | http://localhost:5173 |
| Login | http://localhost:5173/login |
| Register | http://localhost:5173/register |
| Dashboard | http://localhost:5173/app |
| Admin | http://localhost:8000/admin |
| API Health | http://localhost:8000/api/health/ |

## Default Admin Credentials

Created during setup when you run `createsuperuser`

## Email Testing in Development

In development mode, emails are logged to console. Check your terminal output.

To use real email, configure .env with Gmail credentials.

## Common Issues & Solutions

### "ModuleNotFoundError: No module named 'django'"
```bash
cd backend
source venv/bin/activate
pip install -r requirements.txt
```

### "Connection refused" on API calls
- Ensure Django is running on port 8000
- Check that CORS is configured in Django settings

### "No module named 'face_recognition'"
- Optional, but recommended: `pip install face-recognition`
- System works without it, facial verification just returns success

### Database locked error
- Delete `db.sqlite3` and re-run migrations (development only)

## Project Structure

```
backend/          - Django REST API
frontend/         - React TypeScript SPA
docs/            - Documentation
tests/           - Test files
.env             - Environment variables
```

## Next Steps

1. **Customize**: Edit colors, logos, text in components
2. **Deploy**: Follow IMPLEMENTATION_GUIDE.md deployment section
3. **Extend**: Add more features using provided APIs
4. **Monitor**: Set up logging and monitoring

## API Quick Reference

### Get User Token
```bash
curl -X POST http://localhost:8000/api/auth/login/ \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password"}'
```

### Request OTP
```bash
curl -X POST http://localhost:8000/api/auth/request-otp/ \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","full_name":"John Doe"}'
```

### Verify OTP
```bash
curl -X POST http://localhost:8000/api/auth/verify-otp/ \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","otp_code":"123456"}'
```

### Time In
```bash
curl -X POST http://localhost:8000/api/attendance/time-in/ \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id":1,
    "application_id":1,
    "gps_latitude":14.5547,
    "gps_longitude":121.0244
  }'
```

## Support & Documentation

- **Full Setup Guide**: See IMPLEMENTATION_GUIDE.md
- **Features List**: See SYSTEM_FEATURES.md
- **API Docs**: In IMPLEMENTATION_GUIDE.md
- **Troubleshooting**: IMPLEMENTATION_GUIDE.md

## Video Demo (if available)
Check the project repository for demo videos

## Important Notes

1. **Face Recognition**: Optional, requires `face-recognition` package
2. **Email**: Uses console logger in development, configure SMTP in production
3. **Database**: SQLite for development, use PostgreSQL for production
4. **Security**: Update SECRET_KEY and disable DEBUG in production
5. **CORS**: Already configured for local development

## What's Included

✓ Complete User Registration System
✓ Role-based Access Control (Student, Instructor, HTE)
✓ OTP Email Verification
✓ OJT Application Workflow
✓ Attendance Tracking with GPS & Facial Recognition
✓ Hour Calculation
✓ Announcement System
✓ Task Management (like Google Classroom)
✓ HTE Monitoring & Access Control
✓ Admin Dashboard
✓ JWT Authentication
✓ 42 API Endpoints
✓ Production-ready Architecture

## Getting Help

1. Check error messages carefully
2. Review IMPLEMENTATION_GUIDE.md
3. Check Django logs and browser console
4. Verify environment variables in .env

## Quick Customization

### Change Application Colors
Edit `src/styles/theme.css`

### Change Company Name
Edit text in components and settings

### Add Custom Logo
Replace logo image in `src/` directory

### Modify Email Templates
Edit email sending code in `backend/security/auth_views.py`

---

**Ready to build awesome OJT system!** 🚀

For detailed documentation, see IMPLEMENTATION_GUIDE.md
