# OJT Management System - Complete Implementation Guide

## System Overview

The OJT (On-the-Job Training) Management System is a comprehensive platform for managing student training programs with three main user roles:

- **Student**: Registers for OJT programs, tracks attendance, and completes assigned tasks
- **OJT Instructor**: Creates QR codes for enrollment, reviews applications, posts announcements, and tracks progress
- **HTE (Host Training Establishment)**: Partner organizations that can monitor student progress

## Features Implemented

### 1. User Registration & Authentication
- **Role-based Registration**: Student, OJT Instructor, HTE
- **OTP Verification**: Email-based one-time passwords for verification
- **Multiple Registration Methods**:
  - Manual registration with email verification
  - Google OAuth support (for HTE users)
- **JWT Token-based Authentication**: Secure API access with refresh tokens

### 2. Student Management
- Complete student profile with personal information
- OJT Application workflow (Pending → Approved/Rejected → Completed)
- Geofenced attendance tracking
- Facial recognition for identity verification
- Automatic hour calculation

### 3. OJT Instructor Features
- QR code generation for student enrollment
- Application review and approval/rejection
- Announcement posting
- Task assignment (similar to Google Classroom)
- Progress monitoring

### 4. Attendance System
- Time In / Time Out with GPS verification
- Geofencing validation (must be within company location)
- Facial recognition verification
- Automatic hour calculation across multiple days
- Photo documentation

### 5. HTE Monitoring
- View enrolled students
- Monitor attendance records
- Track rendered hours
- Request access (with instructor approval)

## Backend Setup

### Prerequisites
- Python 3.10+
- Django 4.2+
- SQLite3 (or PostgreSQL for production)

### Installation

1. **Clone and navigate to backend**:
```bash
cd backend
```

2. **Create virtual environment**:
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

3. **Install dependencies**:
```bash
pip install -r requirements.txt
```

4. **Create .env file** (copy from .env.example):
```bash
cp .env.example .env
```

5. **Configure Email** (in .env):
```
EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USE_TLS=True
EMAIL_HOST_USER=your-email@gmail.com
EMAIL_HOST_PASSWORD=your-app-password
DEFAULT_FROM_EMAIL=noreply@ojtsystem.com
```

*Note: For Google Mail, generate an App Password in Google Account settings*

6. **Run migrations**:
```bash
python manage.py makemigrations
python manage.py migrate
```

7. **Create superuser**:
```bash
python manage.py createsuperuser
```

8. **Install face recognition** (optional but recommended):
```bash
pip install face-recognition
```

9. **Run development server**:
```bash
python manage.py runserver 0.0.0.0:8000
```

Access admin at: http://localhost:8000/admin

## Frontend Setup

### Prerequisites
- Node.js 18+
- npm or yarn

### Installation

1. **Navigate to frontend**:
```bash
cd ..  # Go to root
```

2. **Install dependencies**:
```bash
npm install
```

3. **Create .env.local** (in root directory):
```
VITE_DJANGO_API_URL=http://localhost:8000/api
VITE_FACE_VERIFICATION_TOLERANCE=0.6
```

4. **Run development server**:
```bash
npm run dev
```

Access at: http://localhost:5173

## API Endpoints

### Authentication

#### Request OTP
```bash
POST /api/auth/request-otp/
Content-Type: application/json

{
  "email": "user@example.com",
  "full_name": "John Doe"
}
```

#### Verify OTP
```bash
POST /api/auth/verify-otp/
Content-Type: application/json

{
  "email": "user@example.com",
  "otp_code": "123456"
}
```

#### Register Student
```bash
POST /api/auth/register-student/
Content-Type: application/json

{
  "email": "student@example.com",
  "password": "securepassword",
  "first_name": "John",
  "last_name": "Doe",
  "middle_initial": "M",
  "age": 20,
  "address": "123 Main St"
}
```

#### Register Instructor
```bash
POST /api/auth/register-instructor/
Content-Type: application/json

{
  "email": "instructor@example.com",
  "password": "securepassword",
  "first_name": "Jane",
  "last_name": "Smith",
  "course": "Computer Science",
  "department": "IT Department",
  "institution": "University XYZ"
}
```

#### Register HTE
```bash
POST /api/auth/register-hte/
Content-Type: application/json

{
  "email": "hte@company.com",
  "first_name": "Company",
  "last_name": "Representative",
  "company_name": "Tech Corp",
  "company_address": "456 Business Ave",
  "contact_person": "John Manager",
  "contact_phone": "+63-123-456-7890"
}
```

#### Login
```bash
POST /api/auth/login/
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "securepassword"
}
```

Returns:
```json
{
  "success": true,
  "tokens": {
    "access": "jwt_token_here",
    "refresh": "refresh_token_here"
  },
  "user": {
    "id": 1,
    "email": "user@example.com",
    "name": "John Doe",
    "role": "student"
  }
}
```

### OJT Application

#### Submit Application
```bash
POST /api/application/submit/
Authorization: Bearer {token}
Content-Type: application/json

{
  "user_id": 1,
  "instructor_id": 2,
  "company_name": "Tech Innovations Inc",
  "company_address": "123 Tech Park Road",
  "gps_latitude": 14.5547,
  "gps_longitude": 121.0244,
  "geofence_radius": 100,
  "start_date": "2025-05-01",
  "end_date": "2025-08-31",
  "required_hours": 240
}
```

#### Approve Application
```bash
POST /api/application/approve/
Authorization: Bearer {token}
Content-Type: application/json

{
  "application_id": 1
}
```

#### Reject Application
```bash
POST /api/application/reject/
Authorization: Bearer {token}
Content-Type: application/json

{
  "application_id": 1,
  "rejection_reason": "Missing required documents"
}
```

### Attendance

#### Time In
```bash
POST /api/attendance/time-in/
Authorization: Bearer {token}
Content-Type: application/json

{
  "user_id": 1,
  "application_id": 1,
  "gps_latitude": 14.5547,
  "gps_longitude": 121.0244
}
```

#### Time Out
```bash
POST /api/attendance/time-out/
Authorization: Bearer {token}
Content-Type: application/json

{
  "user_id": 1,
  "application_id": 1
}
```

### Announcements

#### Post Announcement
```bash
POST /api/announcement/post/
Authorization: Bearer {token}
Content-Type: multipart/form-data

instructor_id: 1
title: "Welcome to the Program"
content: "This is an important announcement"
image: (optional file)
```

#### Get Announcements
```bash
GET /api/announcement/list/?instructor_id=1
Authorization: Bearer {token}
```

### HTE Access

#### Request Access
```bash
POST /api/hte/request-access/
Authorization: Bearer {token}
Content-Type: application/json

{
  "hte_id": 1,
  "application_id": 1
}
```

#### Approve Access
```bash
POST /api/hte/approve-access/
Authorization: Bearer {token}
Content-Type: application/json

{
  "request_id": 1
}
```

#### Reject Access
```bash
POST /api/hte/reject-access/
Authorization: Bearer {token}
Content-Type: application/json

{
  "request_id": 1,
  "reason": "Not from our organization"
}
```

## Database Models

### User
- Email (unique)
- Role (student/instructor/hte)
- Is Verified
- Timestamps

### Student
- User (OneToOne)
- Age, Address
- Year Level, Section
- School name
- Student ID

### OJT Instructor
- User (OneToOne)
- Course, Department
- Institution
- QR Code, QR Code Image

### HTE
- User (OneToOne)
- Company Name, Address
- Contact Person, Phone

### StudentOJTApplication
- Student, Instructor, HTE
- Company Details
- GPS Coordinates, Geofence Radius
- Dates, Required Hours
- Status (pending/approved/rejected/completed)

### TimeRecord
- Student, Application
- Time In, Time Out
- Hours Rendered
- Date, Notes
- Is Approved

### Announcement
- Instructor
- Title, Content
- Image (optional)

### Task, StudentTask
- Instructor creates tasks
- Students submit work
- Grading system

## Frontend Components

### Pages
- **Login**: Email/password or Google OAuth
- **RoleSelection**: Choose student/instructor/HTE
- **Register**: Multi-step form based on role
- **Dashboard**: Role-specific home page
- **OJTApplication**: Submit application after scanning QR code
- **TimeRecord**: View attendance history
- **Announcements**: View instructor announcements
- **Profile**: User profile management

### Components
- **FaceCapture**: Facial recognition registration and verification
- **GeofenceMap**: Map-based location verification
- **QRScanner**: QR code scanning for enrollment
- **TimeInOut**: Attendance tracking UI

## Security Features

1. **OTP Email Verification**: Ensures email ownership
2. **JWT Token Authentication**: Secure API access
3. **Role-Based Access Control**: Different permissions per role
4. **Geofencing**: Location-based access control
5. **Facial Recognition**: Identity verification
6. **CORS Protection**: Configured CORS headers
7. **CSRF Protection**: Django CSRF middleware
8. **Password Hashing**: Django's password hashing

## Deployment Considerations

### Production Checklist
1. Set `DJANGO_DEBUG=0` in .env
2. Configure secure `DJANGO_SECRET_KEY`
3. Set up proper email service
4. Configure database (PostgreSQL recommended)
5. Set up HTTPS/SSL
6. Configure static and media file serving
7. Set up logging and monitoring
8. Run `collectstatic`
9. Consider using Gunicorn/uWSGI for WSGI server
10. Set up reverse proxy (Nginx/Apache)

### Environment Variables
```bash
# Django
DJANGO_SECRET_KEY=<generate-secure-key>
DJANGO_DEBUG=0
DJANGO_ALLOWED_HOSTS=yourdomain.com,www.yourdomain.com
DJANGO_USE_HTTPS=1
DJANGO_CORS_ORIGINS=https://yourdomain.com

# Database (if using PostgreSQL)
DB_ENGINE=django.db.backends.postgresql
DB_NAME=ojt_db
DB_USER=ojt_user
DB_PASSWORD=<secure-password>
DB_HOST=localhost
DB_PORT=5432

# Email
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USE_TLS=True
EMAIL_HOST_USER=<email@gmail.com>
EMAIL_HOST_PASSWORD=<app-password>
DEFAULT_FROM_EMAIL=noreply@ojtsystem.com
```

## Troubleshooting

### Face Recognition Not Working
1. Ensure `face-recognition` is installed
2. Check that images are in supported formats (JPG, PNG)
3. Verify `FACE_RECOGNITION_TOLERANCE` in settings

### Geofencing Issues
1. Ensure GPS coordinates are accurate
2. Check geofence radius (default 100m)
3. GPS signals can be unreliable indoors

### Email Not Sending
1. Check email credentials in .env
2. For Gmail, use App Password, not account password
3. Check firewall/network restrictions on SMTP port
4. Verify SMTP settings with email provider

### CORS Errors
1. Update `DJANGO_CORS_ORIGINS` in settings
2. Include frontend origin (with protocol and port)
3. Restart Django server

## Future Enhancements

1. **Mobile App**: Native React Native/Flutter app
2. **Real-time Notifications**: WebSocket updates
3. **Integration with Calendar**: Google Calendar/Outlook sync
4. **Performance Analytics**: Detailed reporting dashboard
5. **Multi-language Support**: i18n implementation
6. **Two-Factor Authentication**: Enhanced security
7. **Batch Operations**: Bulk user import
8. **Advanced Reporting**: Custom report generation
9. **Audit Logging**: Track all system changes
10. **Offline Mode**: Progressive Web App (PWA) support

## Support & Maintenance

### Regular Tasks
- Monitor application logs
- Backup database regularly
- Update dependencies monthly
- Review security advisories
- Clean up old files
- Monitor server resources

### Performance Optimization
- Enable database query caching
- Implement Redis for sessions
- Compress images before upload
- Enable CDN for static files
- Use database indexes efficiently

## License & Attribution

This system was developed as a comprehensive OJT management solution incorporating:
- Django REST Framework for API
- React with TypeScript for frontend
- Advanced geofencing and facial recognition
- Role-based access control
- Email verification system

## Contact & Support

For issues, questions, or suggestions, refer to the project documentation or contact the development team.

---

**Last Updated**: 2025
**Version**: 1.0
