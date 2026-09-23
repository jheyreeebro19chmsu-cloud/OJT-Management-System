"""
DeepFace Facial Recognition Service Module.
Integrates serengil/deepface (https://github.com/serengil/deepface)
into the OJT Management System with multi-tier fallback capabilities.
"""

import os
import sys
import logging
from typing import Dict, Any, Optional, Union, List

# Ensure UTF-8 output encoding on Windows so DeepFace emojis don't fail cp1252 consoles
if sys.platform == "win32":
    try:
        if hasattr(sys.stdout, "reconfigure"):
            sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        if hasattr(sys.stderr, "reconfigure"):
            sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

# Configure PyTorch as the DeepFace backend engine
os.environ.setdefault("DEEPFACE_BACKEND_ENGINE", "pytorch")

logger = logging.getLogger(__name__)

# Flag to indicate if DeepFace is available
DEEPFACE_AVAILABLE = False
try:
    from deepface import DeepFace  # type: ignore
    DEEPFACE_AVAILABLE = True
    logger.info("DeepFace successfully loaded into OJT Management System.")
except Exception as e:
    logger.warning("DeepFace not currently available in environment: %s", e)
    DeepFace = None


def is_deepface_available() -> bool:
    """Check if DeepFace library is available for facial verification."""
    return DEEPFACE_AVAILABLE


def verify_face_pair(
    img1: Union[str, Any],
    img2: Union[str, Any],
    model_name: str = "Facenet512",
    detector_backend: str = "retinaface",
    distance_metric: str = "cosine",
    enforce_detection: bool = True,
    align: bool = True,
    strict_threshold: float = 0.28,
) -> Dict[str, Any]:
    """
    Compare two faces using serengil/deepface with calibrated strict threshold.
    
    Args:
        img1: Path to registered face image or numpy array
        img2: Path to captured face image or numpy array
        model_name: 'Facenet512' (recommended high-accuracy 512-d embeddings), 'VGG-Face', etc.
        detector_backend: 'retinaface' (accurate landmark alignment), 'mediapipe', 'yolov8', 'dlib'
        distance_metric: 'cosine', 'euclidean', 'euclidean_l2'
        enforce_detection: If True, raises error when no face is found.
        align: Whether to align faces according to eye positions.
        strict_threshold: Enforced strict threshold (0.28 for Facenet512/cosine prevents false positives).
        
    Returns:
        Dict containing success, matched, distance, threshold, confidence, model, and message.
    """
    if not DEEPFACE_AVAILABLE or DeepFace is None:
        return _fallback_verification(img1, img2)

    # Detectors to attempt in order of priority.
    # If retinaface is unavailable or slow, try mediapipe, yolov8, dlib.
    detectors_to_try = [detector_backend]
    for alt in ["mediapipe", "yolov8", "dlib", "opencv", "ssd"]:
        if alt not in detectors_to_try:
            detectors_to_try.append(alt)

    result = None
    actual_detector = detector_backend
    last_error = None

    for det in detectors_to_try:
        try:
            result = DeepFace.verify(
                img1_path=img1,
                img2_path=img2,
                model_name=model_name,
                detector_backend=det,
                distance_metric=distance_metric,
                enforce_detection=enforce_detection,
                align=align,
            )
            actual_detector = det
            break
        except ValueError as val_err:
            err_full = f"{val_err} {val_err.__cause__} {val_err.__context__}".lower()
            # If the error is due to a missing package or engine for the detector
            if any(x in err_full for x in ["retina-face", "tensorflow", "mediapipe", "yolov8", "install", "violated", "confirm that opencv"]):
                logger.info("Detector '%s' unavailable (%s), trying fallback detector...", det, val_err)
                last_error = val_err
                continue
            # Legitimate detection failure when enforce_detection=True
            logger.warning("DeepFace detection warning: %s", val_err)
            return {
                "success": False,
                "matched": False,
                "verified": False,
                "error": str(val_err),
                "message": "No face detected in image. Please center your face in good lighting.",
                "backend": "deepface",
            }
        except Exception as err:
            err_full = f"{err} {getattr(err, '__cause__', '')} {getattr(err, '__context__', '')}".lower()
            if any(x in err_full for x in ["retinaface", "retina-face", "tensorflow", "mediapipe", "yolov8", "install"]):
                logger.info("Detector '%s' error (%s), trying fallback detector...", det, err)
                last_error = err
                continue
            logger.error("DeepFace verification failed with detector %s: %s", det, err)
            last_error = err
            continue

    if result is None:
        logger.error("All DeepFace detector backends exhausted: %s", last_error)
        return _fallback_verification(img1, img2, original_error=str(last_error))

    try:
        # Step 1: Check Returned Distance & Calibrated Threshold
        distance = float(result.get("distance", 1.0))
        default_threshold = float(result.get("threshold", 0.40))
        
        # PRINT RAW DEEPFACE RESULT TO SERVER TERMINAL
        print("\n" + "=" * 45)
        print("=== DEEPFACE DEBUG RESULT ===")
        print("Verified (Raw Default):", result.get("verified"))
        print(f"Calculated Distance   : {distance:.4f}")
        print(f"DeepFace Default Thresh: {default_threshold:.4f}")
        print(f"Enforced Strict Thresh : {strict_threshold:.4f}")
        print("Model                  :", result.get("model", model_name))
        print("Detector Backend       :", actual_detector)
        print("Similarity Metric      :", distance_metric)

        # Enforce strict calibrated threshold instead of relying blindly on raw default
        # For Facenet512 with cosine metric, 0.28 prevents cross-identity false positives
        is_match = distance <= strict_threshold
        print(f"Final Strict Match     : {is_match}")
        print("=" * 45 + "\n")
        
        # Calculate human-readable similarity confidence percentage (0.0 to 1.0)
        confidence = max(0.0, min(1.0, 1.0 - (distance / (strict_threshold * 2.0 if strict_threshold > 0 else 1.0))))

        return {
            "success": True,
            "matched": is_match,
            "verified": is_match,
            "distance": round(distance, 4),
            "threshold": round(strict_threshold, 4),
            "default_threshold": round(default_threshold, 4),
            "confidence": round(confidence, 4),
            "similarity_percent": round(confidence * 100, 1),
            "model": result.get("model", model_name),
            "detector_backend": actual_detector,
            "similarity_metric": distance_metric,
            "facial_areas": result.get("facial_areas", {}),
            "time": result.get("time", 0),
            "backend": "deepface",
            "message": "Face verified successfully with DeepFace." if is_match else f"Face mismatch. Scanned identity does not match profile (distance: {distance:.4f} > {strict_threshold})."
        }
    except Exception as err:
        logger.error("DeepFace verification processing failed: %s", err)
        return _fallback_verification(img1, img2, original_error=str(err))


def extract_face_embedding(
    img: Union[str, Any],
    model_name: str = "VGG-Face",
    detector_backend: str = "dlib",
    enforce_detection: bool = False,
) -> Optional[List[float]]:
    """
    Extract facial feature vector/embedding representation using DeepFace.represent.
    """
    if not DEEPFACE_AVAILABLE or DeepFace is None:
        return None

    detectors = [detector_backend] + [d for d in ["dlib", "opencv", "ssd"] if d != detector_backend]
    for det in detectors:
        try:
            embeddings = DeepFace.represent(
                img_path=img,
                model_name=model_name,
                detector_backend=det,
                enforce_detection=enforce_detection,
            )
            if embeddings and len(embeddings) > 0:
                return embeddings[0].get("embedding")
            return None
        except Exception as e:
            err_str = str(e).lower()
            if "retina-face" in err_str or "tensorflow" in err_str or "violated" in err_str:
                continue
            logger.warning("DeepFace embedding extraction error with detector %s: %s", det, e)
            continue
    return None


def analyze_face_attributes(
    img: Union[str, Any],
    actions: Optional[List[str]] = None,
    detector_backend: str = "dlib",
    enforce_detection: bool = False,
) -> Dict[str, Any]:
    """
    Analyze facial attributes: age, gender, emotion, and race.
    """
    if actions is None:
        actions = ["age", "gender", "emotion"]

    if not DEEPFACE_AVAILABLE or DeepFace is None:
        return {"success": False, "message": "DeepFace not available for attribute analysis."}

    detectors = [detector_backend] + [d for d in ["dlib", "opencv", "ssd"] if d != detector_backend]
    for det in detectors:
        try:
            results = DeepFace.analyze(
                img_path=img,
                actions=actions,
                detector_backend=det,
                enforce_detection=enforce_detection,
            )
            if isinstance(results, list) and len(results) > 0:
                res = results[0]
            else:
                res = results

            return {
                "success": True,
                "age": res.get("age"),
                "gender": res.get("dominant_gender", res.get("gender")),
                "emotion": res.get("dominant_emotion"),
                "emotions_breakdown": res.get("emotion"),
                "race": res.get("dominant_race"),
                "region": res.get("region", {}),
                "backend": "deepface",
            }
        except Exception as e:
            err_str = str(e).lower()
            if "retina-face" in err_str or "tensorflow" in err_str or "violated" in err_str:
                continue
    return {"success": False, "error": "Attribute analysis failed across all detectors.", "backend": "deepface"}


def _fallback_verification(img1: Any, img2: Any, original_error: Optional[str] = None) -> Dict[str, Any]:
    """
    Graceful fallback to legacy dlib face_recognition if available.
    """
    try:
        import face_recognition  # type: ignore

        # Load images if file paths
        known_image = face_recognition.load_image_file(img1) if isinstance(img1, str) else img1
        unknown_image = face_recognition.load_image_file(img2) if isinstance(img2, str) else img2

        known_encodings = face_recognition.face_encodings(known_image)
        unknown_encodings = face_recognition.face_encodings(unknown_image)

        if not known_encodings:
            return {
                "success": False,
                "matched": False,
                "message": "No face found in registered image.",
                "backend": "face_recognition_fallback",
            }

        if not unknown_encodings:
            return {
                "success": False,
                "matched": False,
                "message": "No face found in captured image.",
                "backend": "face_recognition_fallback",
            }

        dist = face_recognition.face_distance([known_encodings[0]], unknown_encodings[0])[0]
        tolerance = 0.6
        matched = bool(dist <= tolerance)
        confidence = max(0.0, 1.0 - float(dist))

        return {
            "success": True,
            "matched": matched,
            "verified": matched,
            "distance": round(float(dist), 4),
            "threshold": tolerance,
            "confidence": round(confidence, 4),
            "similarity_percent": round(confidence * 100, 1),
            "model": "dlib-resnet",
            "backend": "face_recognition_fallback",
            "message": "Face matched via fallback engine." if matched else "Face did not match.",
            "note": f"DeepFace fallback activated: {original_error}" if original_error else "DeepFace fallback activated",
        }
    except Exception as e:
        return {
            "success": False,
            "matched": False,
            "message": f"Facial verification engine unavailable: {original_error or e}",
            "backend": "none",
        }
