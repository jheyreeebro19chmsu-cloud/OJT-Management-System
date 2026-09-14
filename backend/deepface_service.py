"""
DeepFace Facial Recognition Service Module.
Integrates serengil/deepface (https://github.com/serengil/deepface)
into the OJT Management System with multi-tier fallback capabilities.
"""

import os
import logging
from typing import Dict, Any, Optional, Union, List

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
    model_name: str = "VGG-Face",
    detector_backend: str = "opencv",
    distance_metric: str = "cosine",
    enforce_detection: bool = False,
    align: bool = True,
) -> Dict[str, Any]:
    """
    Compare two faces using serengil/deepface.
    
    Args:
        img1: Path to registered face image or numpy array
        img2: Path to captured face image or numpy array
        model_name: 'VGG-Face', 'Facenet', 'Facenet512', 'OpenFace', 'DeepFace', 'DeepID', 'ArcFace', 'SFace'
        detector_backend: 'opencv', 'ssd', 'dlib', 'mtcnn', 'retinaface', 'mediapipe', 'yolov8'
        distance_metric: 'cosine', 'euclidean', 'euclidean_l2'
        enforce_detection: If True, raises error when no face is found. If False, tolerates uncropped frames.
        align: Whether to align faces according to eye positions.
        
    Returns:
        Dict containing success, matched, distance, threshold, confidence, model, and message.
    """
    if not DEEPFACE_AVAILABLE or DeepFace is None:
        return _fallback_verification(img1, img2)

    try:
        result = DeepFace.verify(
            img1_path=img1,
            img2_path=img2,
            model_name=model_name,
            detector_backend=detector_backend,
            distance_metric=distance_metric,
            enforce_detection=enforce_detection,
            align=align,
        )

        verified = bool(result.get("verified", False))
        distance = float(result.get("distance", 1.0))
        threshold = float(result.get("threshold", 0.4))
        
        # Calculate human-readable similarity confidence percentage (0.0 to 1.0)
        # Cosine distance: 0 = identical, 1 = completely different
        if distance_metric == "cosine":
            confidence = max(0.0, min(1.0, 1.0 - (distance / (threshold * 2.0 if threshold > 0 else 1.0))))
        else:
            confidence = max(0.0, min(1.0, 1.0 - (distance / (threshold * 2.0 if threshold > 0 else 1.0))))

        return {
            "success": True,
            "matched": verified,
            "verified": verified,
            "distance": round(distance, 4),
            "threshold": round(threshold, 4),
            "confidence": round(confidence, 4),
            "similarity_percent": round(confidence * 100, 1),
            "model": result.get("model", model_name),
            "detector_backend": detector_backend,
            "similarity_metric": distance_metric,
            "facial_areas": result.get("facial_areas", {}),
            "time": result.get("time", 0),
            "backend": "deepface",
            "message": "Face verified successfully with DeepFace." if verified else "Face does not match registered profile."
        }
    except ValueError as val_err:
        # Usually triggered when enforce_detection=True and no face is detected
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
        logger.error("DeepFace verification failed: %s", err)
        # Attempt fallback to legacy face_recognition if available
        return _fallback_verification(img1, img2, original_error=str(err))


def extract_face_embedding(
    img: Union[str, Any],
    model_name: str = "VGG-Face",
    detector_backend: str = "opencv",
    enforce_detection: bool = False,
) -> Optional[List[float]]:
    """
    Extract facial feature vector/embedding representation using DeepFace.represent.
    """
    if not DEEPFACE_AVAILABLE or DeepFace is None:
        return None

    try:
        embeddings = DeepFace.represent(
            img_path=img,
            model_name=model_name,
            detector_backend=detector_backend,
            enforce_detection=enforce_detection,
        )
        if embeddings and len(embeddings) > 0:
            return embeddings[0].get("embedding")
        return None
    except Exception as e:
        logger.warning("DeepFace embedding extraction error: %s", e)
        return None


def analyze_face_attributes(
    img: Union[str, Any],
    actions: Optional[List[str]] = None,
    detector_backend: str = "opencv",
    enforce_detection: bool = False,
) -> Dict[str, Any]:
    """
    Analyze facial attributes: age, gender, emotion, and race.
    """
    if actions is None:
        actions = ["age", "gender", "emotion"]

    if not DEEPFACE_AVAILABLE or DeepFace is None:
        return {"success": False, "message": "DeepFace not available for attribute analysis."}

    try:
        results = DeepFace.analyze(
            img_path=img,
            actions=actions,
            detector_backend=detector_backend,
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
        logger.warning("DeepFace attribute analysis error: %s", e)
        return {"success": False, "error": str(e), "backend": "deepface"}


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
