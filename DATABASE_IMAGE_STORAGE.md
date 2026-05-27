# Database Image Storage Implementation

## Overview

The face recognition system now stores all face images **directly in the database** in addition to the file system. This ensures:

✅ **Data Backup:** Images are part of database backups  
✅ **Data Integrity:** No orphaned files from deleted records  
✅ **Faster Retrieval:** Binary data stored alongside face encodings  
✅ **Scalability:** Works better with distributed databases and cloud storage  
✅ **Backward Compatibility:** File system storage still works as fallback  

---

## Database Schema Changes

### FaceRegistration Model

**New Fields Added:**

```python
class FaceRegistration(models.Model):
    # Existing fields
    user = models.OneToOneField(User, ...)
    employee_id = models.CharField(max_length=64, unique=True)
    image = models.ImageField(upload_to="face_registrations/", null=True, blank=True)
    face_encoding = models.JSONField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    # NEW: Database image storage
    image_data = models.BinaryField(null=True, blank=True)  # Binary image data
    image_format = models.CharField(max_length=10, default='jpeg')  # Format: jpeg, png, gif
    
    # NEW: Track updates
    updated_at = models.DateTimeField(auto_now=True)
```

**Database Table Schema:**
```sql
CREATE TABLE security_faceregistration (
    id INTEGER PRIMARY KEY,
    employee_id VARCHAR(64) UNIQUE NOT NULL,
    image VARCHAR(100),  -- File path (backward compat)
    image_data LONGBLOB,  -- Binary image in database
    image_format VARCHAR(10) DEFAULT 'jpeg',
    face_encoding JSON,  -- Face encoding
    created_at DATETIME,
    updated_at DATETIME
);
```

### AttendancePhoto Model

**New Fields Added:**

```python
class AttendancePhoto(models.Model):
    # Existing fields
    employee_id = models.CharField(max_length=64)
    application = models.ForeignKey(StudentOJTApplication, ...)
    action = models.CharField(max_length=8, choices=ACTION_CHOICES)
    image = models.ImageField(upload_to="attendance_photos/", null=True, blank=True)
    geofence_verified = models.BooleanField(default=False)
    face_verified = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    
    # NEW: Database image storage
    image_data = models.BinaryField(null=True, blank=True)  # Binary image data
    image_format = models.CharField(max_length=10, default='jpeg')  # Format: jpeg, png, gif
```

---

## How Images Are Stored

### Registration Flow

```
User uploads face image (mobile app)
    ↓
Backend receives image (uploaded file or base64)
    ↓
Extract binary data:
    - If uploaded file: Read file.read() → binary
    - If base64: base64.b64decode() → binary
    ↓
Determine format from filename:
    - .png → image_format = 'png'
    - .jpg/.jpeg → image_format = 'jpeg'
    - .gif → image_format = 'gif'
    ↓
Save BOTH:
    ├─ Filesystem: registration.image.save(...) [backward compat]
    └─ Database: registration.image_data = binary data
    ↓
Save record: registration.save()
    ↓
✅ Image stored in database with metadata
```

### Attendance Photo Flow

```
User captures face during attendance (mobile app)
    ↓
Backend receives image
    ↓
Extract binary data + determine format
    ↓
Save BOTH:
    ├─ Filesystem: record.image.save(...) [backward compat]
    └─ Database: record.image_data = binary data
    ↓
Save record: record.save()
    ↓
✅ Attendance photo stored in database
```

---

## Data Storage Details

### Image Format Support

| Format | MIME Type | Extension | Support |
|--------|-----------|-----------|---------|
| JPEG | image/jpeg | .jpg, .jpeg | ✅ Full |
| PNG | image/png | .png | ✅ Full |
| GIF | image/gif | .gif | ✅ Full |
| WebP | image/webp | .webp | ✅ Full |
| BMP | image/bmp | .bmp | ✅ Full |

### Binary Data Size

**Typical Face Image Sizes:**
- Low quality (10% JPEG): ~5-10 KB
- Medium quality (30% JPEG): ~15-25 KB
- High quality (100% PNG): ~100-300 KB
- Average stored: ~20 KB per image

**Database Impact:**
- 1,000 face images: ~20 MB
- 10,000 attendance records: ~200 MB
- 1,000,000 records: ~20 GB (manageable)

---

## Migration Guide

### Apply Database Migration

```bash
cd backend
python manage.py migrate security 0003_store_images_in_database
```

**Migration Steps:**
1. Add `image_data` BinaryField to FaceRegistration
2. Add `image_format` CharField to FaceRegistration
3. Add `updated_at` DateTimeField to FaceRegistration
4. Make `image` field nullable (backup compat)
5. Add `image_data` BinaryField to AttendancePhoto
6. Add `image_format` CharField to AttendancePhoto
7. Make `image` field nullable (backup compat)

### Backup Existing Images

**Optional:** Migrate existing file system images to database

```python
# Run this management command to populate image_data for existing records
python manage.py shell

from security.models import FaceRegistration
import os

for reg in FaceRegistration.objects.filter(image_data__isnull=True):
    if reg.image and os.path.exists(reg.image.path):
        with open(reg.image.path, 'rb') as f:
            reg.image_data = f.read()
            reg.save()
        print(f"Migrated: {reg.employee_id}")
```

---

## API Responses

### Register Face - Success Response

```json
{
  "success": true,
  "image_url": "http://server/media/face_registrations/...",
  "brightness": 125.4,
  "status": "good",
  "image_stored_in_database": true,
  "image_format": "jpeg"
}
```

### Save Attendance Photo - Success Response

```json
{
  "success": true,
  "image_url": "http://server/media/attendance_photos/...",
  "image_stored_in_database": true,
  "image_format": "jpeg"
}
```

---

## Utility Functions

### Get Image from Database

```python
from security.utils import get_image_from_database

# Get image from database (preferred)
face_reg = FaceRegistration.objects.get(employee_id='EMP001')
image_bytes = get_image_from_database(face_reg, use_database_image=True)

# Now use with PIL, cv2, face_recognition, etc.
from PIL import Image
pil_img = Image.open(image_bytes)

# Or with face_recognition
import face_recognition
import numpy as np
arr = np.array(pil_img)
face_encodings = face_recognition.face_encodings(arr)
```

### Convert Binary to Base64

```python
from security.utils import image_binary_to_base64

face_reg = FaceRegistration.objects.get(employee_id='EMP001')
if face_reg.image_data:
    base64_url = image_binary_to_base64(
        face_reg.image_data, 
        face_reg.image_format
    )
    # Result: "data:image/jpeg;base64,/9j/4AAQSkZJRg..."
    # Can be used directly in <img src="{base64_url}">
```

### Convert Binary to File

```python
from security.utils import image_binary_to_file

face_reg = FaceRegistration.objects.get(employee_id='EMP001')
if face_reg.image_data:
    image_file = image_binary_to_file(
        face_reg.image_data,
        face_reg.image_format
    )
    # image_file is a BytesIO object
    # Can be used with PIL.Image.open(image_file)
```

### Delete Image from Database

```python
from security.utils import delete_image_from_database

face_reg = FaceRegistration.objects.get(employee_id='EMP001')
delete_image_from_database(face_reg)
```

---

## Code Examples

### Retrieve and Use Face Image

```python
from security.models import FaceRegistration
from security.utils import image_binary_to_file
import face_recognition

def get_face_encoding_from_database(employee_id):
    """Get face encoding by loading image from database"""
    try:
        registration = FaceRegistration.objects.get(employee_id=employee_id)
        
        # Check if encoding is cached
        if registration.face_encoding:
            import numpy as np
            return np.array(registration.face_encoding)
        
        # Load image from database
        if registration.image_data:
            image_file = image_binary_to_file(
                registration.image_data,
                registration.image_format
            )
            
            # Convert to numpy array
            from PIL import Image
            pil_img = Image.open(image_file)
            img_array = np.array(pil_img)
            
            # Generate encoding
            encodings = face_recognition.face_encodings(img_array)
            if encodings:
                # Cache for future use
                registration.face_encoding = list(encodings[0])
                registration.save()
                return encodings[0]
        
        return None
    
    except FaceRegistration.DoesNotExist:
        return None
```

### Export All Images from Database

```python
from security.models import FaceRegistration
import os
from datetime import datetime

def export_images_from_database():
    """Export all images stored in database to zip file"""
    import zipfile
    
    export_dir = f"exports/images_{datetime.now().strftime('%Y%m%d_%H%M%S')}.zip"
    
    with zipfile.ZipFile(export_dir, 'w') as zf:
        for reg in FaceRegistration.objects.filter(image_data__isnull=False):
            filename = f"{reg.employee_id}.{reg.image_format}"
            zf.writestr(filename, reg.image_data)
    
    return export_dir
```

---

## Database Query Examples

### Find All Images Stored in Database

```sql
SELECT employee_id, image_format, LENGTH(image_data) as size_bytes
FROM security_faceregistration
WHERE image_data IS NOT NULL
ORDER BY created_at DESC;
```

### Total Database Image Size

```sql
SELECT 
    CONCAT(ROUND(SUM(LENGTH(image_data))/1024/1024, 2), ' MB') as total_size
FROM security_faceregistration
WHERE image_data IS NOT NULL;
```

### Find Images Missing from Database

```sql
SELECT employee_id, image
FROM security_faceregistration
WHERE image_data IS NULL AND image IS NOT NULL;
```

---

## Backup and Restore

### Backup Images from Database

```bash
# Backup entire database (includes images)
mysqldump -u user -p database_name > backup.sql

# Or with compression
mysqldump -u user -p database_name | gzip > backup.sql.gz
```

### Restore Images from Database

```bash
# Restore from backup
mysql -u user -p database_name < backup.sql

# Or from compressed backup
gunzip < backup.sql.gz | mysql -u user -p database_name
```

---

## Performance Considerations

### Database Size Impact

```
With 1,000 registered faces (~20 KB each):
- Total image data: ~20 MB
- Database size increase: ~20-30 MB
- Backup size increase: ~5-10 MB (compressed)

With 100,000 attendance records (~20 KB each):
- Total image data: ~2 GB
- Database size increase: ~2-3 GB
- Backup size increase: ~500-800 MB (compressed)
```

### Query Performance

**Advantages:**
- ✅ Images stored with face encoding data
- ✅ No separate file I/O operations
- ✅ Atomic transactions (image + metadata together)
- ✅ Works with cloud databases (AWS RDS, etc.)

**Considerations:**
- ⚠️ Large BinaryField queries are slower
- ⚠️ Need adequate database disk space
- ⚠️ Backups will be larger

### Optimization Tips

```python
# 1. Use select_related/prefetch_related carefully
registrations = FaceRegistration.objects.filter(
    face_verified=True
).values('employee_id', 'image_format')  # Don't select image_data

# 2. Create index on image_format (optional)
class Meta:
    indexes = [
        models.Index(fields=['image_format']),
        models.Index(fields=['created_at']),
    ]

# 3. Archive old images periodically
old_photos = AttendancePhoto.objects.filter(
    created_at__lt=datetime.now() - timedelta(days=365)
)
for photo in old_photos:
    photo.image_data = None  # Clear old data
    photo.save()
```

---

## Troubleshooting

### Issue: Large Database File Size

**Solution:**
```python
# Archive old attendance photos
from django.utils import timezone
from datetime import timedelta

cutoff_date = timezone.now() - timedelta(days=90)
old_photos = AttendancePhoto.objects.filter(created_at__lt=cutoff_date)

# Export before clearing
export_images(old_photos)

# Clear image data
old_photos.update(image_data=None)
```

### Issue: Slow Database Backups

**Solution:**
```bash
# Use compression
mysqldump -u user -p --single-transaction database_name | gzip > backup.sql.gz

# Or exclude image data
mysqldump -u user -p database_name --ignore-table=database_name.security_faceregistration > backup_no_images.sql
```

### Issue: Migration Failed

**Solution:**
```bash
# Rollback migration
python manage.py migrate security 0002_otpverification_attendancephoto_face_verified_and_more

# Fix issues and re-migrate
python manage.py migrate security 0003_store_images_in_database
```

---

## Summary

✅ **Images now stored in database:**
- FaceRegistration.image_data (BinaryField)
- AttendancePhoto.image_data (BinaryField)

✅ **Format tracked:**
- FaceRegistration.image_format (CharField)
- AttendancePhoto.image_format (CharField)

✅ **Backward compatible:**
- File system storage still works
- Fallback to files if database image missing
- Can coexist during migration

✅ **Utility functions provided:**
- `get_image_from_database()` - Retrieve images
- `image_binary_to_base64()` - Convert to data URL
- `image_binary_to_file()` - Convert to BytesIO
- `delete_image_from_database()` - Remove images

🚀 **Ready to use:** Migration file included, apply with `python manage.py migrate security`

