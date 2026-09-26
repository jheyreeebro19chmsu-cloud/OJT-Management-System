"""
InsightFace Facial Recognition Service Module.
Integrates deepinsight/insightface (https://github.com/deepinsight/insightface)
into the OJT Management System backend with ArcFace 512-d embeddings and ONNX Runtime.
"""

import os
import sys
import base64
import logging
import threading
from typing import Dict, Any, Optional, Union, List
import numpy as np

# Ensure UTF-8 output encoding on Windows
if sys.platform == "win32":
    try:
        if hasattr(sys.stdout, "reconfigure"):
            sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        if hasattr(sys.stderr, "reconfigure"):
            sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

logger = logging.getLogger(__name__)

# Check if InsightFace and OpenCV are available
INSIGHTFACE_AVAILABLE = False
try:
    import cv2  # type: ignore
    import insightface  # type: ignore
    from insightface.app import FaceAnalysis  # type: ignore
    INSIGHTFACE_AVAILABLE = True
    logger.info("InsightFace successfully imported into OJT Management System.")
except Exception as e:
    logger.warning("InsightFace not currently available in environment: %s", e)
    FaceAnalysis = None
    cv2 = None

# Thread-safe lazy singleton for FaceAnalysis app
_app_lock = threading.Lock()
_app_instance: Optional[Any] = None


def is_insightface_available() -> bool:
    """Check if InsightFace library and models are available."""
    return INSIGHTFACE_AVAILABLE


def get_face_analysis_app() -> Optional[Any]:
    """
    Thread-safe lazy initialization for InsightFace FaceAnalysis.
    Uses 'buffalo_s' lightweight high-speed model pack with ONNX CPU execution.
    """
    global _app_instance
    if not INSIGHTFACE_AVAILABLE or FaceAnalysis is None:
        return None

    if _app_instance is not None:
        return _app_instance

    with _app_lock:
        if _app_instance is None:
            try:
                logger.info("Initializing InsightFace FaceAnalysis ('buffalo_s' on CPU)...")
                app = FaceAnalysis(name='buffalo_s', providers=['CPUExecutionProvider'])
                # ctx_id=-1 for CPU execution, det_size=(640, 640) for standard camera feed resolution
                app.prepare(ctx_id=-1, det_size=(640, 640))
                _app_instance = app
                logger.info("InsightFace FaceAnalysis ('buffalo_s') successfully prepared and cached.")
            except Exception as e:
                logger.error("Failed to initialize InsightFace FaceAnalysis: %s", e)
                return None

    return _app_instance


def to_cv2_image(image_input: Any) -> Optional[np.ndarray]:
    """
    Normalize various image input types into a standard OpenCV BGR numpy array.
    Supports file path (str), base64 string, PIL Image, or file-like buffer.
    """
    if image_input is None:
        return None

    if cv2 is None:
        return None

    try:
        # 1. Path string or Base64 data URL
        if isinstance(image_input, str):
            # Check if it's base64
            if image_input.startswith("data:image") or ";base64," in image_input or len(image_input) > 500:
                raw_b64 = image_input.split(",", 1)[1] if "," in image_input else image_input
                img_bytes = base64.b64decode(raw_b64)
                arr = np.frombuffer(img_bytes, dtype=np.uint8)
                return cv2.imdecode(arr, cv2.IMREAD_COLOR)

            # File path on filesystem
            if os.path.exists(image_input):
                return cv2.imread(image_input)

        # 2. Raw bytes or BytesIO
        if isinstance(image_input, bytes):
            arr = np.frombuffer(image_input, dtype=np.uint8)
            return cv2.imdecode(arr, cv2.IMREAD_COLOR)

        if hasattr(image_input, 'read'):
            if hasattr(image_input, 'seek'):
                image_input.seek(0)
            raw = image_input.read()
            arr = np.frombuffer(raw, dtype=np.uint8)
            return cv2.imdecode(arr, cv2.IMREAD_COLOR)

        # 3. Already a numpy array
        if isinstance(image_input, np.ndarray):
            # Check dimensions
            if len(image_input.shape) == 2:
                return cv2.cvtColor(image_input, cv2.COLOR_GRAY2BGR)
            if len(image_input.shape) == 3:
                # If RGB format (commonly loaded by PIL or face_recognition), convert to BGR for InsightFace
                return image_input

        # 4. PIL Image
        if hasattr(image_input, 'convert') and hasattr(image_input, 'mode'):
            rgb = image_input.convert('RGB')
            arr = np.array(rgb)
            return cv2.cvtColor(arr, cv2.COLOR_RGB2BGR)

    except Exception as e:
        logger.warning("to_cv2_image conversion failed: %s", e)

    return None


def get_face_embedding(image_input: Any) -> Optional[np.ndarray]:
    """
    Extract a normalized 512-dimensional embedding vector from the largest face in the image.
    Returns unit-normalized float32 vector or None if no face is detected.
    """
    app = get_face_analysis_app()
    if app is None:
        logger.error("InsightFace app is not available for feature extraction.")
        return None

    img = to_cv2_image(image_input)
    if img is None:
        logger.warning("Could not convert input to OpenCV image array.")
        return None

    try:
        faces = app.get(img)
        if not faces or len(faces) == 0:
            return None

        # Sort detected faces by bounding box area (largest face in frame first)
        faces = sorted(faces, key=lambda x: (x.bbox[2] - x.bbox[0]) * (x.bbox[3] - x.bbox[1]), reverse=True)
        embedding = faces[0].normed_embedding

        if embedding is not None and isinstance(embedding, np.ndarray):
            # Ensure float32 and unit-normalized
            norm = np.linalg.norm(embedding)
            if norm > 0:
                embedding = embedding / norm
            return embedding.astype(np.float32)

    except Exception as e:
        logger.error("InsightFace embedding extraction error: %s", e)

    return None


def verify_attendance(
    scanned_img: Any,
    registered_profile_img_or_emb: Any,
    match_threshold: float = 0.45
) -> Dict[str, Any]:
    """
    Verifies attendance by comparing scanned camera image against registered face.
    Supports either registered image or precomputed 512-d embedding vector.

    Args:
        scanned_img: Camera capture (file path, numpy array, bytes, or base64)
        registered_profile_img_or_emb: Profile photo OR precomputed 512-d list/ndarray
        match_threshold: Strict cosine similarity threshold (default: 0.45)
                         Standard ArcFace:
                         >= 0.45 - 0.50 : Genuine match
                         <  0.40        : Definite mismatch

    Returns:
        Dict with match, similarity, distance, threshold, confidence, and message.
    """
    emb1 = get_face_embedding(scanned_img)

    # Check if registered_profile_img_or_emb is already an embedding vector
    emb2 = None
    if isinstance(registered_profile_img_or_emb, (list, tuple)):
        if len(registered_profile_img_or_emb) in (512, 128):
            emb2 = np.array(registered_profile_img_or_emb, dtype=np.float32)
            norm = np.linalg.norm(emb2)
            if norm > 0:
                emb2 = emb2 / norm

    elif isinstance(registered_profile_img_or_emb, np.ndarray):
        if registered_profile_img_or_emb.ndim == 1 and len(registered_profile_img_or_emb) in (512, 128):
            emb2 = registered_profile_img_or_emb.astype(np.float32)
            norm = np.linalg.norm(emb2)
            if norm > 0:
                emb2 = emb2 / norm

    if emb2 is None:
        emb2 = get_face_embedding(registered_profile_img_or_emb)

    if emb1 is None or emb2 is None:
        return {
            "success": False,
            "match": False,
            "matched": False,
            "similarity": 0.0,
            "message": "Face could not be detected in one of the images.",
            "error_code": "NO_FACE_IN_CAPTURED" if emb1 is None else "NO_FACE_IN_REGISTERED"
        }

    # Cosine Similarity between two unit-normalized vectors is strictly the dot product
    similarity = float(np.dot(emb1, emb2))
    similarity = max(-1.0, min(1.0, similarity))

    is_match = similarity >= match_threshold
    distance = float(max(0.0, 1.0 - similarity))

    # Normalized confidence score (mapped between threshold boundary and 1.0)
    confidence = float(max(0.0, min(1.0, (similarity - 0.1) / 0.8)))

    log_msg = f"[InsightFace] Cosine Similarity: {similarity:.4f} (Threshold: {match_threshold})"
    print(log_msg)
    logger.info("%s -> Match: %s", log_msg, is_match)

    return {
        "success": True,
        "match": is_match,
        "matched": is_match,
        "similarity": round(similarity, 4),
        "distance": round(distance, 4),
        "threshold": match_threshold,
        "confidence": round(confidence, 4),
        "model": "InsightFace-ArcFace (buffalo_s)",
        "message": "Face verified successfully" if is_match else "Face mismatch. Access denied."
    }


def compare_faces(
    known_image_input: Any,
    unknown_image_input: Any,
    match_threshold: float = 0.45,
    **kwargs: Any
) -> Dict[str, Any]:
    """
    Standard interface for comparing two faces using InsightFace.
    Provides backward compatibility with previous verification calls.
    """
    return verify_attendance(
        scanned_img=unknown_image_input,
        registered_profile_img_or_emb=known_image_input,
        match_threshold=match_threshold,
    )


def verify_face_pair(
    img1: Any,
    img2: Any,
    strict_threshold: float = 0.45,
    **kwargs: Any
) -> Dict[str, Any]:
    """
    Drop-in replacement for verify_face_pair using InsightFace ArcFace model.
    """
    return verify_attendance(
        scanned_img=img2,
        registered_profile_img_or_emb=img1,
        match_threshold=strict_threshold,
    )
