"""
Face Recognition Checker powered by InsightFace (ArcFace buffalo_s) with fallback support.
"""

from insightface_service import compare_faces as insightface_compare, is_insightface_available
from deepface_service import verify_face_pair, is_deepface_available


def compare_faces(
    known_image_path,
    unknown_image_path,
    match_threshold=0.45,
    model_name="Facenet512",
    detector_backend="retinaface",
    strict_threshold=0.28,
    **kwargs
):
    """
    Compare a registered face and a captured face using InsightFace ArcFace (buffalo_s).
    Returns rich verification metadata including matched status, similarity, distance, threshold, and confidence.
    Gracefully falls back to DeepFace if InsightFace is unavailable.
    """
    if is_insightface_available():
        return insightface_compare(
            known_image_input=known_image_path,
            unknown_image_input=unknown_image_path,
            match_threshold=match_threshold,
        )

    if is_deepface_available():
        return verify_face_pair(
            img1=known_image_path,
            img2=unknown_image_path,
            model_name=model_name,
            detector_backend=detector_backend,
            distance_metric="cosine",
            enforce_detection=True,
            strict_threshold=strict_threshold,
        )

    return {
        "success": False,
        "match": False,
        "matched": False,
        "message": "No facial recognition backend available."
    }
