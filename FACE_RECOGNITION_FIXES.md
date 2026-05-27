# Face Recognition Bug Fixes - Implementation Guide

This document provides ready-to-use fixes for the bugs identified in the face recognition system.

---

## Fix #1: Handle Multiple Faces Detection (CRITICAL)

### Location
`backend/security/views.py` - `verify_face()` function

### Current Buggy Code (Lines ~290)
```python
unknown_encodings = face_recognition.face_encodings(unknown_image)

if not unknown_encodings:
    return JsonResponse(
        {"success": False, "message": "No face found in captured image."},
        status=422,
    )

distance = face_recognition.face_distance([known_encoding], unknown_encodings[0])[0]
```

### Fixed Code
```python
unknown_encodings = face_recognition.face_encodings(unknown_image)

if not unknown_encodings:
    return JsonResponse(
        {"success": False, "message": "No face found in captured image."},
        status=422,
    )

# NEW: Reject images with multiple faces
if len(unknown_encodings) > 1:
    return JsonResponse(
        {
            "success": False,
            "message": f"Multiple faces detected ({len(unknown_encodings)}). Please capture only your face.",
            "faces_detected": len(unknown_encodings),
        },
        status=422,
    )

# Now safe to use first encoding
distance = face_recognition.face_distance([known_encoding], unknown_encodings[0])[0]
```

### Why This Fixes It
- Prevents silent acceptance of group photos
- Explicitly informs user of issue
- Adds security layer against spoofing attempts

---

## Fix #2: Validate Image Quality

### Location
`backend/security/utils.py` (create new file if needed)

### Add This New Function
```python
from PIL import Image
import numpy as np
from django.core.files.uploadedfile import UploadedFile
import cv2
import logging

logger = logging.getLogger(__name__)

def validate_face_image_quality(image_path):
    """
    Validate that an image meets minimum quality standards for face recognition.
    
    Returns:
        dict: {
            'valid': bool,
            'message': str,
            'issues': list[str]
        }
    """
    issues = []
    
    try:
        # Open image
        img = Image.open(image_path)
        
        # Check dimensions
        min_size = 100
        if img.width < min_size or img.height < min_size:
            issues.append(f"Image too small ({img.width}x{img.height}px, min {min_size}x{min_size}px)")
        
        # Convert to RGB if needed
        if img.mode not in ['RGB', 'L', 'RGBA']:
            img = img.convert('RGB')
        
        # Convert to numpy array for analysis
        img_array = np.array(img)
        
        # Check for blur using Laplacian variance (higher = sharper)
        if len(img_array.shape) == 3:
            gray = cv2.cvtColor(img_array, cv2.COLOR_RGB2GRAY)
        else:
            gray = img_array
        
        laplacian = cv2.Laplacian(gray, cv2.CV_64F)
        blur_score = laplacian.var()
        
        min_blur_score = 100  # Threshold for acceptable sharpness
        if blur_score < min_blur_score:
            issues.append(f"Image too blurry (score: {blur_score:.1f}, min: {min_blur_score})")
        
        # Check brightness (mean pixel value)
        brightness = np.mean(gray)
        if brightness < 30:
            issues.append(f"Image too dark (brightness: {brightness:.1f})")
        elif brightness > 240:
            issues.append(f"Image too bright (brightness: {brightness:.1f})")
        
        # Check contrast
        contrast = np.std(gray)
        if contrast < 10:
            issues.append(f"Image low contrast (contrast: {contrast:.1f})")
        
        logger.info(f"Image quality check - Size: {img.width}x{img.height}, "
                   f"Blur: {blur_score:.1f}, Brightness: {brightness:.1f}, "
                   f"Contrast: {contrast:.1f}")
        
        return {
            'valid': len(issues) == 0,
            'message': 'Image quality acceptable' if not issues else 'Image quality issues',
            'issues': issues,
            'metrics': {
                'blur_score': blur_score,
                'brightness': brightness,
                'contrast': contrast
            }
        }
        
    except Exception as e:
        logger.error(f"Image validation error: {e}")
        return {
            'valid': False,
            'message': f'Failed to validate image: {str(e)}',
            'issues': ['Image processing error']
        }
```

### Use This in `register_face()` View
```python
# In backend/security/views.py, modify register_face function

from .utils import validate_face_image_quality  # Add import

@csrf_exempt
@require_security_api_key
def register_face(request: HttpRequest) -> JsonResponse:
    # ... existing code ...
    
    if image_file:
        registration.image.save(image_file.name, image_file, save=True)
    else:
        content = _content_file_from_base64(str(image_b64), f"{employee_id}_{uuid.uuid4().hex}")
        registration.image.save(content.name, content, save=True)
    
    # NEW: Validate image quality BEFORE encoding
    quality_check = validate_face_image_quality(registration.image.path)
    if not quality_check['valid']:
        # Delete bad image and return error
        registration.image.delete(save=False)
        return JsonResponse(
            {
                "success": False,
                "message": "Image quality too poor for registration",
                "issues": quality_check['issues'],
                "metrics": quality_check.get('metrics')
            },
            status=422
        )
    
    # ... rest of existing code for face encoding ...
```

---

## Fix #3: Add Comprehensive Error Logging

### Location
`backend/security/views.py` - add logging to `verify_face()`

### Add to Top of File
```python
import logging

logger = logging.getLogger('face_recognition')

# In Django settings.py, add:
# LOGGING = {
#     'version': 1,
#     'disable_existing_loggers': False,
#     'handlers': {
#         'file': {
#             'level': 'INFO',
#             'class': 'logging.FileHandler',
#             'filename': 'logs/face_recognition.log',
#         },
#     },
#     'loggers': {
#         'face_recognition': {
#             'handlers': ['file'],
#             'level': 'INFO',
#             'propagate': True,
#         },
#     },
# }
```

### Update `verify_face()` Function
```python
def verify_face(request: HttpRequest) -> JsonResponse:
    if request.method != "POST":
        return JsonResponse({"error": "Method not allowed"}, status=405)

    try:
        import face_recognition
    except BaseException as e:
        logger.error(f"face_recognition library not available: {e}")
        return JsonResponse(
            {
                "success": False,
                "message": "face_recognition is not installed on the server.",
            },
            status=501,
        )

    data = _json_body(request)
    employee_id = _employee_id_from_request(request, data)
    
    logger.info(f"Face verification attempt for employee: {employee_id}")

    # ... existing code ...

    if known_encoding is None:
        logger.warning(f"No face found in registered image for employee {employee_id}")
        return JsonResponse(
            {"success": False, "message": "No face found in registered image/data."},
            status=422,
        )

    # ... existing code ...

    if not unknown_encodings:
        logger.warning(f"No face found in captured image for employee {employee_id}")
        return JsonResponse(
            {"success": False, "message": "No face found in captured image."},
            status=422,
        )
    
    # NEW: Multiple face detection
    if len(unknown_encodings) > 1:
        logger.warning(f"Multiple faces detected ({len(unknown_encodings)}) for employee {employee_id}")
        return JsonResponse(
            {
                "success": False,
                "message": f"Multiple faces detected ({len(unknown_encodings)}). Please capture only your face.",
                "faces_detected": len(unknown_encodings),
            },
            status=422,
        )

    distance = face_recognition.face_distance([known_encoding], unknown_encodings[0])[0]
    matched = distance <= tolerance
    confidence = max(0.0, 1.0 - float(distance))
    
    # Log results
    log_message = f"Face verification {'SUCCESS' if matched else 'FAILED'} for {employee_id} - Distance: {distance:.3f}, Tolerance: {tolerance}, Confidence: {confidence:.2%}"
    logger.info(log_message) if matched else logger.warning(log_message)

    return JsonResponse(
        {
            "success": True,
            "matched": matched,
            "distance": float(distance),
            "tolerance": float(tolerance),
            "confidence": confidence,
            "message": "Face matched." if matched else "Face did not match.",
        }
    )
```

---

## Fix #4: Improve Tolerance Configuration

### Location
`backend/ojt_backend/settings.py`

### Add Configuration Section
```python
# ============================================================================
# FACE RECOGNITION SETTINGS
# ============================================================================

FACE_RECOGNITION_SETTINGS = {
    # Tolerance for face matching (0.0 = exact match, 1.0 = any face)
    # Recommended values:
    # - 0.5: Very strict (few false positives, more false negatives)
    # - 0.6: Balanced (default, good for most cases)
    # - 0.7: Permissive (more false positives, few false negatives)
    'tolerance': float(os.getenv('FACE_TOLERANCE', '0.6')),
    
    # Minimum face size in pixels for acceptance
    'min_face_width': 100,
    
    # Maximum number of faces to accept in single capture
    'max_faces_per_capture': 1,
    
    # Image quality thresholds
    'min_blur_score': 100,  # Laplacian variance threshold
    'min_brightness': 30,
    'max_brightness': 240,
    'min_contrast': 10,
    
    # Enable anti-spoofing checks
    'enable_liveness_check': os.getenv('FACE_LIVENESS_CHECK', 'false').lower() == 'true',
}

# Backward compatibility
FACE_RECOGNITION_TOLERANCE = FACE_RECOGNITION_SETTINGS['tolerance']
```

### Use in Views
```python
# In verify_face() function:
from django.conf import settings

settings_config = getattr(settings, 'FACE_RECOGNITION_SETTINGS', {})
tolerance = float(settings_config.get('tolerance', 0.6))
max_faces = int(settings_config.get('max_faces_per_capture', 1))

# ... later in code ...

if len(unknown_encodings) > max_faces:
    return JsonResponse({...}, status=422)
```

---

## Fix #5: Add Rate Limiting for Failed Attempts

### Location
`backend/security/models.py`

### Add Model
```python
from django.utils import timezone
from datetime import timedelta

class FaceVerificationAttempt(models.Model):
    """Track face verification attempts for rate limiting and security"""
    
    employee_id = models.CharField(max_length=100)
    status = models.CharField(
        max_length=10,
        choices=[('success', 'Success'), ('failed', 'Failed')],
        default='failed'
    )
    distance = models.FloatField(null=True, blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    def __str__(self):
        return f"{self.employee_id} - {self.status} ({self.created_at})"
    
    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['employee_id', '-created_at']),
        ]


def get_failed_attempts(employee_id, minutes=1):
    """Get count of failed verification attempts in last N minutes"""
    cutoff = timezone.now() - timedelta(minutes=minutes)
    return FaceVerificationAttempt.objects.filter(
        employee_id=employee_id,
        status='failed',
        created_at__gte=cutoff
    ).count()


def is_account_locked(employee_id, max_attempts=5, lockout_minutes=10):
    """Check if account is temporarily locked due to too many failed attempts"""
    failed_count = get_failed_attempts(employee_id, minutes=lockout_minutes)
    return failed_count >= max_attempts
```

### Use in Views
```python
@csrf_exempt
@require_security_api_key
def verify_face(request: HttpRequest) -> JsonResponse:
    # ... existing code ...
    
    from .models import FaceVerificationAttempt, is_account_locked
    
    employee_id = _employee_id_from_request(request, data)
    
    # Check if locked
    if is_account_locked(employee_id):
        logger.warning(f"Account locked due to too many failed attempts: {employee_id}")
        return JsonResponse(
            {
                "success": False,
                "message": "Too many failed attempts. Please try again later.",
                "locked": True
            },
            status=429  # Too Many Requests
        )
    
    # ... rest of verification logic ...
    
    # Record attempt
    FaceVerificationAttempt.objects.create(
        employee_id=employee_id,
        status='success' if matched else 'failed',
        distance=float(distance),
        ip_address=get_client_ip(request),
        user_agent=request.META.get('HTTP_USER_AGENT', '')
    )
    
    return JsonResponse({...})
```

### Helper Function (in utils.py)
```python
def get_client_ip(request):
    """Get client IP address from request"""
    x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
    if x_forwarded_for:
        ip = x_forwarded_for.split(',')[0]
    else:
        ip = request.META.get('REMOTE_ADDR')
    return ip
```

---

## Fix #6: Add Liveness Detection (Optional but Recommended)

### Location
`ojt-mobile/components/FaceScanner.tsx`

### Add Blink Detection
```typescript
interface FaceScannerProps {
  onCapture: (base64Image: string) => void;
  onCancel: () => void;
  enableLivenessCheck?: boolean;  // NEW
}

export default function FaceScanner({ 
  onCapture, 
  onCancel, 
  enableLivenessCheck = false 
}: FaceScannerProps) {
  const [permission, requestPermission] = useCameraPermissions();
  const [isCapturing, setIsCapturing] = useState(false);
  const [faceDetected, setFaceDetected] = useState(false);
  const [lastCaptureTime, setLastCaptureTime] = useState(0);
  const [eyesOpen, setEyesOpen] = useState(true);  // NEW
  const [blinks, setBlinks] = useState(0);  // NEW
  const [livenessComplete, setLivenessComplete] = useState(false);  // NEW
  const cameraRef = React.useRef<any>(null);

  // NEW: Track blinks for liveness
  const handleFacesDetected = ({ faces }: any) => {
    if (faces.length > 0) {
      const face = faces[0];
      
      if (enableLivenessCheck) {
        // Check if eyes are open/closed for blink detection
        const currentEyesOpen = face.rightEyeOpen && face.leftEyeOpen;
        
        if (eyesOpen && !currentEyesOpen) {
          // Blink detected (eyes going from open to closed)
          setBlinks(prev => prev + 1);
          if (blinks + 1 >= 2) {  // Require 2 blinks
            setLivenessComplete(true);
            setFaceDetected(true);
            setTimeout(() => takePicture(), 100);
            return;
          }
        }
        setEyesOpen(currentEyesOpen);
      }
      
      // Original logic
      if (face.bounds.size.width > 100) {
        if (!enableLivenessCheck) {
          setFaceDetected(true);
          setTimeout(() => takePicture(), 100);
        }
      }
    } else {
      setFaceDetected(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* ... existing camera view ... */}
      
      {enableLivenessCheck && !livenessComplete && (
        <View style={styles.livenessHint}>
          <Text style={styles.hintText}>Blinks detected: {blinks}/2</Text>
          <Text style={styles.hintSmall}>Please blink to prove you're alive</Text>
        </View>
      )}
    </View>
  );
}
```

---

## Summary of Fixes

| Fix | Severity | Time to Implement | Impact |
|-----|----------|-------------------|--------|
| Multiple faces detection | 🔴 Critical | 5 min | Prevents security bypass |
| Image quality validation | 🟡 High | 30 min | Improves accuracy |
| Comprehensive logging | 🟡 High | 15 min | Better debugging |
| Tolerance configuration | 🟡 Medium | 10 min | Easier tuning |
| Rate limiting | 🟡 Medium | 30 min | Security hardening |
| Liveness detection | 🟡 Medium | 1 hour | Anti-spoofing |

**Total Implementation Time: ~2-3 hours**

---

## Testing Recommendations

After implementing fixes, test with:

1. **Single face:** ✅ Should match
2. **Multiple faces:** ✅ Should reject with clear message
3. **Blurry image:** ✅ Should reject in registration
4. **Dark/bright image:** ✅ Should reject in registration
5. **Photo of photo:** ✅ Should reject (if liveness enabled)
6. **Failed attempts:** ✅ Should lock after 5 attempts
7. **Corrupted image:** ✅ Should handle gracefully

