#!/usr/bin/env python3
"""
Standalone DeepFace Biometric Verification Script
Enforces Facenet512 + RetinaFace + Cosine Distance with Strict 0.28 Threshold.
"""

import sys
import os
import argparse
try:
    import cv2
    import numpy as np
    CV2_AVAILABLE = True
except ImportError:
    cv2 = None
    np = None
    CV2_AVAILABLE = False

try:
    from deepface import DeepFace
    DEEPFACE_AVAILABLE = True
except ImportError:
    DEEPFACE_AVAILABLE = False


def verify_face_match(scanned_img_path_or_bytes, registered_profile_path_or_bytes, strict_threshold=0.28):
    """
    Verifies that the scanned face matches the registered profile photo.
    Returns: dict(success=bool, match=bool, distance=float, message=str)
    """
    if not DEEPFACE_AVAILABLE:
        print("[Error] DeepFace is not installed in the current Python environment.")
        return {"success": False, "match": False, "message": "DeepFace is not installed."}

    # Step 3: Validate image bytes or file existence before processing
    if isinstance(scanned_img_path_or_bytes, (bytes, bytearray)):
        if len(scanned_img_path_or_bytes) == 0:
            return {"success": False, "match": False, "message": "Scanned image buffer is empty."}
        nparr1 = np.frombuffer(scanned_img_path_or_bytes, np.uint8)
        img1_check = cv2.imdecode(nparr1, cv2.IMREAD_COLOR)
        if img1_check is None or img1_check.size == 0:
            return {"success": False, "match": False, "message": "Failed to decode scanned image."}
    elif isinstance(scanned_img_path_or_bytes, str):
        if not os.path.exists(scanned_img_path_or_bytes):
            return {"success": False, "match": False, "message": f"Scanned image not found: {scanned_img_path_or_bytes}"}

    if isinstance(registered_profile_path_or_bytes, (bytes, bytearray)):
        if len(registered_profile_path_or_bytes) == 0:
            return {"success": False, "match": False, "message": "Registered profile image buffer is empty."}
        nparr2 = np.frombuffer(registered_profile_path_or_bytes, np.uint8)
        img2_check = cv2.imdecode(nparr2, cv2.IMREAD_COLOR)
        if img2_check is None or img2_check.size == 0:
            return {"success": False, "match": False, "message": "Failed to decode registered profile image."}
    elif isinstance(registered_profile_path_or_bytes, str):
        if not os.path.exists(registered_profile_path_or_bytes):
            return {"success": False, "match": False, "message": f"Profile image not found: {registered_profile_path_or_bytes}"}

    try:
        # Step 2: Switch to High-Accuracy Models and Detectors
        # Try retinaface first, with fallback to mediapipe or yolov8 if retinaface engine is unavailable
        detectors = ["retinaface", "mediapipe", "yolov8", "dlib"]
        result = None
        last_error = None

        for det in detectors:
            try:
                result = DeepFace.verify(
                    img1_path=scanned_img_path_or_bytes,
                    img2_path=registered_profile_path_or_bytes,
                    model_name="Facenet512",        # High dimensional vector representation (512-d)
                    detector_backend=det,           # Precise landmark and face alignment
                    distance_metric="cosine",
                    enforce_detection=True          # Reject immediately if no face is detected
                )
                break
            except ValueError as ve:
                err_str = str(ve).lower()
                if any(x in err_str for x in ["retina-face", "tensorflow", "mediapipe", "yolov8", "install"]):
                    last_error = ve
                    continue
                # Genuine detection failure
                print(f"[Verification Error] No face detected: {ve}")
                return {"success": False, "match": False, "message": "No clear face detected in the camera frame."}
            except Exception as err:
                err_str = str(err).lower()
                if any(x in err_str for x in ["retinaface", "retina-face", "tensorflow", "mediapipe", "yolov8", "install"]):
                    last_error = err
                    continue
                last_error = err
                break

        if result is None:
            return {"success": False, "match": False, "message": f"DeepFace detection failed: {last_error}"}

        # Step 1: Check Returned Distance & Calibrated Threshold
        distance = float(result.get("distance", 1.0))
        default_threshold = float(result.get("threshold", 0.40))
        
        # Enforce strict threshold (0.28 to 0.30 prevents false positives for Facenet512/cosine)
        is_match = distance <= strict_threshold

        print("\n" + "="*45)
        print("--- DEEPFACE VERIFICATION LOG ---")
        print(f"Model                  : {result.get('model', 'Facenet512')}")
        print(f"Similarity Metric      : {result.get('similarity_metric', 'cosine')}")
        print(f"Calculated Distance    : {distance:.4f}")
        print(f"DeepFace Default Thresh: {default_threshold:.4f}")
        print(f"Enforced Strict Thresh : {strict_threshold:.4f}")
        print(f"Final Decision Match   : {is_match}")
        print("="*45 + "\n")

        if not is_match:
            return {
                "success": True,
                "match": False,
                "distance": distance,
                "threshold": strict_threshold,
                "message": f"Face mismatch. Scanned identity does not match profile (distance: {distance:.4f} > {strict_threshold})."
            }

        return {
            "success": True,
            "match": True,
            "distance": distance,
            "threshold": strict_threshold,
            "message": "Face verified successfully."
        }

    except ValueError as ve:
        # Thrown when enforce_detection=True and no face was spotted
        print(f"[Verification Error] No face detected: {ve}")
        return {"success": False, "match": False, "message": "No clear face detected in the camera frame."}
    except Exception as e:
        print(f"[Verification Error] DeepFace failure: {e}")
        return {"success": False, "match": False, "message": f"Verification failed: {str(e)}"}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="DeepFace Strict Biometric Face Verification")
    parser.add_argument("scanned_image", nargs="?", help="Path to scanned/captured face image")
    parser.add_argument("profile_image", nargs="?", help="Path to registered profile face image")
    parser.add_argument("--threshold", type=float, default=0.28, help="Strict threshold (default: 0.28)")

    args = parser.parse_args()

    if not args.scanned_image or not args.profile_image:
        print("Usage: python test_deepface_verification.py <scanned_image_path> <profile_image_path> [--threshold 0.28]")
        sys.exit(0)

    res = verify_face_match(args.scanned_image, args.profile_image, strict_threshold=args.threshold)
    print("Result:", res)
    sys.exit(0 if res.get("match") else 1)
