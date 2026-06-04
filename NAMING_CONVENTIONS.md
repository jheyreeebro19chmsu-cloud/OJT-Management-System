# OJT Management System - Naming Conventions

**Last Updated:** 2026-06-04  
**Status:** Active (Enforce across all contributions)

---

## Table of Contents

1. [Frontend (JavaScript/TypeScript)](#frontend-javascripttypescript)
2. [Backend (Python/Django)](#backend-pythondjango)
3. [API Endpoints](#api-endpoints)
4. [Special Cases](#special-cases)

---

## Frontend (JavaScript/TypeScript)

### Variables & Constants

```typescript
// ✅ GOOD - camelCase for variables
const userName = "john_doe";
const isAuthenticated = true;
const userCount = 42;

// ✅ GOOD - UPPER_SNAKE_CASE for constants
const MAX_RETRIES = 3;
const API_TIMEOUT = 5000;
const DEFAULT_ROLE = "student";

// ❌ AVOID - snake_case for variables
const user_name = "john_doe"; // DON'T DO THIS

// ❌ AVOID - mixed case constants
const maxRetries = 3; // Should be MAX_RETRIES
```

### Functions & Methods

```typescript
// ✅ GOOD - camelCase, verb-based names
function getUserById(id: string) { }
const handleSubmit = () => { }
const formatPhoneNumber = (phone: string) => { }

// ✅ GOOD - Boolean functions start with "is", "has", "can"
const isValidEmail = (email: string): boolean => { }
const hasPermission = (user: User, action: string): boolean => { }
const canAccessDashboard = (role: UserRole): boolean => { }

// ✅ GOOD - Async functions (no special prefix, but use async/await)
const fetchUserData = async (userId: string) => { }
const submitRegistration = async (data: RegistrationData) => { }

// ❌ AVOID - vague names
function process() { } // What does it process?
function getData() { } // Which data?
function check() { } // What are you checking?
```

### React Component Names

```typescript
// ✅ GOOD - PascalCase for components
export function UserProfile() { }
export const AdminDashboard = () => { }
export function FaceCapture({ onSuccess }) { }

// ✅ GOOD - Descriptive component names
function StudentRegistrationForm() { }
function HTEContactInformationStep() { }
function AttendanceRecordsList() { }

// ❌ AVOID - generic names
function Form() { } // Which form?
function Card() { } // What kind of card?
function Container() { } // Too vague
```

### State Variables

```typescript
// ✅ GOOD - Clear, descriptive names
const [formData, setFormData] = useState({});
const [isLoading, setIsLoading] = useState(false);
const [registrationStep, setRegistrationStep] = useState(0);
const [selectedRole, setSelectedRole] = useState("student");

// ✅ GOOD - For object state, use singular form
const [user, setUser] = useState(null);
const [student, setStudent] = useState(null);

// ❌ AVOID - ambiguous names
const [data, setData] = useState({}); // What data?
const [items, setItems] = useState([]); // What items?
```

### File & Folder Names

```
✅ GOOD - kebab-case for files and folders:
src/app/pages/
  ├── register.tsx
  ├── login.tsx
  ├── hte-dashboard.tsx
  └── face-registration.tsx

src/app/components/
  ├── user-profile.tsx
  ├── attendance-card.tsx
  └── face-capture.tsx

src/app/services/
  ├── auth-api.ts
  ├── attendance-api.ts
  └── face-recognition.ts

❌ AVOID:
  register.tsx  (lowercase is okay but less common)
  Register_Component.tsx  (mixed)
  registerComponent.tsx  (camelCase for files)
```

### API Response/Data Types

```typescript
// ✅ GOOD - PascalCase for interfaces/types
interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: "student" | "instructor" | "hte";
}

interface RegistrationResponse {
  success: boolean;
  message: string;
  data: User;
  tokens: {
    access: string;
    refresh: string;
  };
}

interface FaceEncodingData {
  imageUrl: string;
  encodingVector: number[];
  capturedAt: string;
}

// ❌ AVOID - snake_case in interfaces
interface user_data {
  first_name: string;
}
```

---

## Backend (Python/Django)

### Variable & Function Names

```python
# ✅ GOOD - snake_case for variables and functions
user_name = "john_doe"
is_authenticated = True
max_retries = 3

# ✅ GOOD - Descriptive function names
def get_user_by_id(user_id):
    pass

def validate_email_format(email):
    pass

def create_attendance_record(student_id, timestamp):
    pass

# ✅ GOOD - Boolean functions start with "is_", "has_", "can_"
def is_valid_email(email):
    pass

def has_permission(user, action):
    pass

def can_access_dashboard(user_role):
    pass

# ❌ AVOID - camelCase in Python
def getUserById(user_id):  # DON'T DO THIS
    pass

# ❌ AVOID - vague names
def process(data):
    pass

def check():
    pass
```

### Class & Model Names

```python
# ✅ GOOD - PascalCase for classes and models
class User(models.Model):
    pass

class StudentAttendance(models.Model):
    pass

class FaceEncodingData(models.Model):
    pass

class HTTPException(Exception):
    pass

# ✅ GOOD - Django Model field naming (snake_case)
class User(models.Model):
    user_id = models.CharField(max_length=50)
    first_name = models.CharField(max_length=100)
    last_name = models.CharField(max_length=100)
    email_address = models.EmailField(unique=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

# ❌ AVOID - mixed case in model names
class userProfile(models.Model):  # Should be UserProfile
    pass
```

### Constants

```python
# ✅ GOOD - UPPER_SNAKE_CASE for constants
MAX_LOGIN_ATTEMPTS = 5
PASSWORD_MIN_LENGTH = 8
DEFAULT_USER_ROLE = "student"
FACE_ENCODING_DIMENSION = 128
OTP_EXPIRY_MINUTES = 10

# ✅ GOOD - Module-level constants
ALLOWED_IMAGE_FORMATS = ["jpg", "jpeg", "png"]
USER_ROLES = ["student", "instructor", "hte"]
ATTENDANCE_STATUS_CHOICES = [
    ("present", "Present"),
    ("absent", "Absent"),
    ("late", "Late"),
]

# ❌ AVOID - camelCase or lowercase
maxAttempts = 5  # Should be MAX_LOGIN_ATTEMPTS
default_role = "student"  # Should be DEFAULT_USER_ROLE
```

### Django View/Serializer Names

```python
# ✅ GOOD - Descriptive, action-based names
class UserRegistrationView(APIView):
    pass

class StudentAttendanceListView(generics.ListCreateAPIView):
    pass

class HTEDashboardView(APIView):
    pass

class FaceEncodingSerializer(serializers.ModelSerializer):
    pass

class LoginResponseSerializer(serializers.Serializer):
    pass

# ❌ AVOID - vague names
class UserView(APIView):  # Too generic
    pass

class DataSerializer(serializers.Serializer):  # What data?
    pass
```

### URL Patterns

```python
# ✅ GOOD - snake_case in URL patterns
urlpatterns = [
    path('api/auth/register-student/', views.RegisterStudentView.as_view()),
    path('api/auth/register-instructor/', views.RegisterInstructorView.as_view()),
    path('api/auth/register-hte/', views.RegisterHTEView.as_view()),
    path('api/attendance/<int:student_id>/', views.StudentAttendanceView.as_view()),
    path('api/face-encoding/', views.FaceEncodingView.as_view()),
]

# ✅ GOOD - Consistent endpoint names (kebab-case in URLs)
# /api/users/
# /api/attendance/
# /api/face-enrollment/
# /api/hte/dashboard/
```

---

## API Endpoints

### Naming Convention

```
✅ GOOD PATTERNS:

Base URL: /api/v1/

Authentication:
  POST   /api/v1/auth/register/
  POST   /api/v1/auth/login/
  POST   /api/v1/auth/logout/
  POST   /api/v1/auth/refresh-token/

Resources (Collection):
  GET    /api/v1/users/
  POST   /api/v1/users/
  GET    /api/v1/students/
  GET    /api/v1/attendance/

Resource (Detail):
  GET    /api/v1/users/{id}/
  PUT    /api/v1/users/{id}/
  DELETE /api/v1/users/{id}/

Sub-resources:
  GET    /api/v1/users/{id}/attendance/
  GET    /api/v1/students/{id}/face-encoding/
  POST   /api/v1/students/{id}/attendance/check-in/

Role-specific:
  GET    /api/v1/hte/dashboard/
  GET    /api/v1/instructor/students/
  GET    /api/v1/student/profile/

Variations & Actions:
  GET    /api/v1/attendance/report/
  POST   /api/v1/attendance/bulk-upload/
  PATCH  /api/v1/users/{id}/avatar/
  GET    /api/v1/face-encoding/verify/
```

### Request/Response Naming

```json
✅ GOOD - Consistent snake_case in JSON:

Request Body:
{
  "first_name": "John",
  "last_name": "Doe",
  "email_address": "john@example.com",
  "user_role": "student",
  "company_name": "ABC Corp",
  "is_active": true
}

Response Body:
{
  "success": true,
  "message": "User registered successfully",
  "data": {
    "user_id": "usr_123",
    "first_name": "John",
    "created_at": "2026-06-04T10:30:00Z"
  },
  "tokens": {
    "access_token": "jwt_token...",
    "refresh_token": "jwt_token..."
  }
}

Error Response:
{
  "success": false,
  "error": "VALIDATION_ERROR",
  "message": "Email already in use",
  "details": [
    {
      "field": "email_address",
      "message": "This email is already registered"
    }
  ]
}
```

---

## Special Cases

### Naming for Different Roles

```typescript
// ✅ GOOD - Consistent naming across role types
interface StudentProfile {
  age: number;
  address: string;
  school_name: string;
}

interface InstructorProfile {
  course: string;
  department: string;
}

interface HTEProfile {
  company_name: string;
  company_address: string;
  contact_person: string;
}

// In API responses
{
  user_id: "usr_123",
  email: "student@example.com",
  role: "student", // Always lowercase
  profile: {
    age: 20,
    address: "123 Main St"
  }
}
```

### Database Field Names

```python
# ✅ GOOD - snake_case with clear purpose
class Attendance(models.Model):
    student_id = models.ForeignKey(Student, on_delete=models.CASCADE)
    check_in_time = models.DateTimeField()
    check_out_time = models.DateTimeField(null=True, blank=True)
    location_latitude = models.DecimalField(max_digits=10, decimal_places=8)
    location_longitude = models.DecimalField(max_digits=10, decimal_places=8)
    face_verified = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

# Naming pattern:
# - Use full words: check_in_time (not cin_time)
# - Timestamps: created_at, updated_at (Django convention)
# - Booleans: is_*, has_*, can_* prefixes
# - IDs: use field_id for foreign keys
```

### Enum/Choice Fields

```python
# ✅ GOOD - Clear enum names
class UserRole(models.TextChoices):
    STUDENT = "student", "Student"
    INSTRUCTOR = "instructor", "Instructor"
    HTE = "hte", "HTE"

class AttendanceStatus(models.TextChoices):
    PRESENT = "present", "Present"
    ABSENT = "absent", "Absent"
    LATE = "late", "Late"

# Usage:
user.role = UserRole.STUDENT
attendance.status = AttendanceStatus.PRESENT
```

### Error Codes

```typescript
// ✅ GOOD - Consistent error code naming
enum ErrorCode {
  VALIDATION_ERROR = "VALIDATION_ERROR",
  AUTHENTICATION_FAILED = "AUTHENTICATION_FAILED",
  UNAUTHORIZED = "UNAUTHORIZED",
  RESOURCE_NOT_FOUND = "RESOURCE_NOT_FOUND",
  CONFLICT = "CONFLICT", // Duplicate entry
  INTERNAL_SERVER_ERROR = "INTERNAL_SERVER_ERROR",
}

// Usage in API responses
{
  error_code: ErrorCode.VALIDATION_ERROR,
  message: "Invalid email format",
}
```

---

## Summary Table

| Category | Convention | Example |
|----------|-----------|---------|
| **JavaScript Variables** | camelCase | `userName`, `isActive` |
| **JavaScript Functions** | camelCase | `getUserById()`, `formatEmail()` |
| **JavaScript Constants** | UPPER_SNAKE_CASE | `MAX_RETRIES`, `API_TIMEOUT` |
| **React Components** | PascalCase | `UserProfile`, `FaceCapture` |
| **React Files** | kebab-case | `user-profile.tsx`, `face-capture.tsx` |
| **TypeScript Interfaces** | PascalCase | `User`, `RegistrationResponse` |
| **Python Variables** | snake_case | `user_name`, `is_active` |
| **Python Functions** | snake_case | `get_user_by_id()`, `validate_email()` |
| **Python Classes** | PascalCase | `User`, `FaceEncodingData` |
| **Python Constants** | UPPER_SNAKE_CASE | `MAX_LOGIN_ATTEMPTS` |
| **Django Models** | PascalCase | `UserProfile`, `StudentAttendance` |
| **Database Fields** | snake_case | `first_name`, `check_in_time` |
| **API Endpoints** | kebab-case | `/api/v1/face-encoding/` |
| **JSON Fields** | snake_case | `first_name`, `email_address` |

---

## Enforcement

- Review code during PR before merging
- Use linters: ESLint (frontend), Pylint (backend)
- IDE extensions: Code naming checkers
- Update this document if exceptions are needed

---

**Questions?** Update this document and commit changes.
