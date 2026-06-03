# OTP Registration System - Implementation Guide

## Overview

This document outlines the new OTP-based registration workflow for OJT Trainees and HTEs. Instead of completing registration immediately, users now:

1. Request an OTP code from their OJT Instructor
2. Wait for instructor approval
3. Perform facial recognition
4. Complete registration with a password

## Architecture Changes

### Database Changes

#### New Model: `TraineeOTPRequest`

Located in `backend/security/models.py`, this model tracks the entire registration workflow:

```python
class TraineeOTPRequest(models.Model):
    # Request details
    role, email, first_name, last_name, full_name, age, address
    
    # Company/School info
    company_name, company_address, barangay
    
    # Geofencing
    gps_latitude, gps_longitude, geofence_radius
    
    # School info (trainee)
    school_name, course, year_level
    
    # Contact info (HTE)
    contact_person, contact_phone
    
    # OTP & Face
    otp_code, otp_sent_at, avatar, face_photo, face_data
    
    # Status
    status, instructor, requested_at, approved_at, face_registered_at, completed_at
```

### API Endpoints

All new endpoints are under `/api/security/auth/`:

#### 1. Request OTP Registration
```
POST /auth/request-trainee-otp-registration/
```

**Payload:**
```json
{
  "email": "trainee@example.com",
  "first_name": "John",
  "last_name": "Doe",
  "role": "trainee",
  "instructor_email": "instructor@school.edu",
  "age": 20,
  "address": "123 Main St",
  "gps_latitude": 14.5947,
  "gps_longitude": 120.9819,
  "school_name": "ABC University",
  "course": "Information Technology",
  "year_level": "3rd Year",
  "company_name": "XYZ Corporation",
  "company_address": "456 Business Ave",
  "barangay": "Barangay 1"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Registration request sent to instructor.",
  "request_id": "uuid-here",
  "expires_in_minutes": 30
}
```

#### 2. Get Pending Requests (Instructor)
```
GET /auth/get-pending-trainee-requests/?instructor_id=<id>
```

**Response:**
```json
{
  "success": true,
  "requests": [
    {
      "id": "request-id",
      "role": "trainee",
      "email": "trainee@example.com",
      "full_name": "John Doe",
      "company_name": "XYZ Corp",
      "otp_code": "123456",
      "requested_at": "2024-06-03T10:00:00Z",
      "course": "IT"
    }
  ]
}
```

#### 3. Approve Registration (Instructor)
```
POST /auth/approve-trainee-registration/
```

**Payload:**
```json
{
  "request_id": "request-uuid"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Registration approved. OTP sent to trainee.",
  "otp_code": "123456"
}
```

The OTP code is automatically sent to the trainee's email.

#### 4. Reject Registration (Instructor)
```
POST /auth/reject-trainee-registration/
```

**Payload:**
```json
{
  "request_id": "request-uuid",
  "reason": "Missing required documents"
}
```

#### 5. Submit Face Recognition
```
POST /auth/submit-face-recognition/
```

**Form Data:**
```
request_id: "request-uuid"
otp_code: "123456"
face_data: "base64-encoded-face-data"
avatar: <image-file>
```

#### 6. Complete Registration
```
POST /auth/complete-trainee-registration/
```

**Payload:**
```json
{
  "request_id": "request-uuid",
  "password": "securePassword123"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Registration completed successfully!",
  "tokens": {
    "refresh": "...",
    "access": "..."
  },
  "user": {
    "id": 1,
    "email": "trainee@example.com",
    "name": "John Doe",
    "role": "trainee",
    "avatar": "url-to-avatar",
    "company": "XYZ Corp"
  }
}
```

#### 7. Get Instructor by Email
```
GET /auth/get-instructor-by-email/?email=instructor@school.edu
```

**Response:**
```json
{
  "success": true,
  "instructor": {
    "id": 1,
    "email": "instructor@school.edu",
    "name": "Prof. Smith",
    "course": "IT",
    "department": "Engineering"
  }
}
```

#### 8. Check Registration Status
```
GET /auth/check-registration-status/?request_id=request-uuid
```

**Response:**
```json
{
  "success": true,
  "status": "approved",
  "request": {
    "id": "request-uuid",
    "status": "approved",
    "email": "trainee@example.com",
    "full_name": "John Doe",
    "approved_at": "2024-06-03T10:05:00Z"
  }
}
```

## Frontend Components

### New Pages

#### 1. `RegisterOTP.tsx`
Located in `src/app/pages/RegisterOTP.tsx`

**Steps:**
- Role selection (Trainee/HTE)
- Personal & company information
- Location capture
- OTP request to instructor
- Waiting for approval (with polling)
- Face recognition
- Complete registration

**Key Features:**
- Multi-step registration wizard
- Real-time location mapping
- Face photo capture
- Auto-polling for instructor approval
- Comprehensive form validation

#### 2. `InstructorPendingRequests.tsx`
Located in `src/app/pages/InstructorPendingRequests.tsx`

**Features:**
- Display all pending trainee/HTE requests
- Show trainee details: name, email, company, school
- Display OTP code (with hide/show toggle)
- Approve/Reject buttons
- Rejection reason modal
- Auto-refresh every 10 seconds
- Responsive grid layout

## Integration Steps

### 1. Backend Setup

```bash
# Create Django migration
python manage.py makemigrations security

# Run migration
python manage.py migrate security

# Create superuser if needed
python manage.py createsuperuser
```

### 2. Admin Panel

The `TraineeOTPRequest` model is registered in Django Admin:

- Access at `/admin/security/traineeotp request/`
- Filter by role, status, and date
- View complete request details
- See avatar and face photos

### 3. Instructor Dashboard Integration

Add to your instructor dashboard (e.g., `InstructorDashboard.tsx`):

```tsx
import InstructorPendingRequests from './InstructorPendingRequests';

// In your instructor navigation
<nav>
  <Link to="/dashboard">Dashboard</Link>
  <Link to="/pending-requests">Pending Requests ({pendingCount})</Link>
  <Link to="/announcements">Announcements</Link>
</nav>

// Add route
<Route path="/pending-requests" element={<InstructorPendingRequests instructorId={currentUser.id} />} />
```

### 4. Registration Navigation

Update your main app routes to use the new OTP registration:

```tsx
<Route path="/register-otp" element={<RegisterOTP />} />
```

Update navigation to point to `/register-otp` instead of the old registration.

### 5. Email Configuration

Ensure your Django email is configured in `settings.py`:

```python
EMAIL_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'
EMAIL_HOST = 'smtp.gmail.com'  # or your email provider
EMAIL_PORT = 587
EMAIL_USE_TLS = True
EMAIL_HOST_USER = 'your-email@gmail.com'
EMAIL_HOST_PASSWORD = 'your-app-password'
DEFAULT_FROM_EMAIL = 'your-email@gmail.com'
```

## Data Flow

### Registration Request Flow

```
Trainee/HTE
    ↓
Request OTP (with personal + company info)
    ↓
Backend creates TraineeOTPRequest (status: pending)
    ↓
Generate OTP code
    ↓
Send notification email to instructor
    ↓
Trainee waits (polling check-registration-status)
    ↓
[Instructor Reviews]
    ↓
Instructor approves → OTP sent to trainee email
    ↓
Trainee receives OTP
    ↓
Trainee performs face recognition
    ↓
Trainee completes registration with password
    ↓
User account created
    ↓
TraineeOTPRequest status: completed
```

### Instructor Workflow

```
Pending Requests Dashboard
    ↓
View pending trainee/HTE requests
    ↓
See OTP code (hide/show)
    ↓
Review trainee info:
  - Name, email
  - Company/School info
  - Requested date/time
    ↓
Approve → OTP emailed to trainee
    ↓
OR Reject with reason
```

## Important Fields in TraineeOTPRequest

### Company/Geofencing
- `company_name`: Where trainee/HTE works
- `company_address`: Full address
- `gps_latitude`, `gps_longitude`: Location coordinates
- `geofence_radius`: Default 100m, adjustable

### Avatar & Face Recognition
- `avatar`: Profile picture (stored as image file)
- `face_photo`: Original face capture
- `face_data`: Facial recognition embedding/data
- `face_registered_at`: When face was captured

### Status Tracking
- `status`: pending → approved → completed
- `requested_at`: When request was made
- `approved_at`: When instructor approved
- `completed_at`: When full registration completed

## Admin Panel Access

In Django Admin (`/admin/`):

1. Navigate to `Security → Trainee OTP Requests`
2. Filter by:
   - Role (Trainee/HTE)
   - Status (Pending/Approved/Rejected/Completed)
   - Date range
3. View:
   - Trainee/HTE details
   - Company information
   - Avatar and face photos
   - OTP code
   - All timestamps

## Clean Data & Organization

The system automatically organizes data:

### Media Storage
```
media/
  avatars/              # User profile pictures
    {request_id}_{timestamp}.jpg
  face_registrations/   # Face recognition photos
    {request_id}_face.jpg
```

### Database Normalization
- Separate models for Student, HTE, OJTInstructor
- TraineeOTPRequest as bridge for pending approvals
- Clean relationship tracking via foreign keys

### Audit Trail
- `requested_at`: Full timestamp
- `approved_at`: When approved
- `face_registered_at`: When face captured
- `completed_at`: When registration completed

## Testing

### Manual Testing Checklist

1. **OTP Request**
   - [ ] Trainee can request OTP with all info
   - [ ] Notification sent to instructor
   - [ ] Request visible in pending list

2. **Instructor Approval**
   - [ ] Instructor can see all pending requests
   - [ ] Can view trainee details
   - [ ] Can approve and send OTP

3. **Face Recognition**
   - [ ] Trainee receives OTP email
   - [ ] Can capture face photo
   - [ ] Face data stored in database

4. **Registration Completion**
   - [ ] Trainee can set password
   - [ ] User account created
   - [ ] Avatar assigned
   - [ ] Company info stored
   - [ ] Geofencing configured

5. **Data Verification**
   - [ ] Avatar visible in user profile
   - [ ] Company name in user record
   - [ ] Geofence coordinates stored
   - [ ] All data clean and organized

## Troubleshooting

### OTP Not Sending

```python
# Check email configuration
python manage.py shell
>>> from django.core.mail import send_mail
>>> send_mail('Test', 'Test message', 'from@example.com', ['to@example.com'])
```

### Migration Issues

```bash
# Reset migrations (development only)
python manage.py migrate security zero
python manage.py makemigrations security
python manage.py migrate security
```

### Face Recognition Not Saving

Ensure:
- `media/` directory exists and is writable
- Django `MEDIA_URL` and `MEDIA_ROOT` configured
- Permissions allow file uploads

## Next Steps

1. Create migration: `python manage.py makemigrations`
2. Run migration: `python manage.py migrate`
3. Update instructor dashboard with pending requests view
4. Update registration navigation to use `/register-otp`
5. Configure email settings
6. Test end-to-end workflow
7. Deploy to production
