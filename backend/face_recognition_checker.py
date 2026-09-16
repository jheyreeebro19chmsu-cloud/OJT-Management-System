"""
Face Recognition Checker powered by DeepFace with fallback support.
"""

from deepface_service import verify_face_pair, is_deepface_available

def compare_faces(known_image_path, unknown_image_path, model_name="VGG-Face", detector_backend="retinaface"):
    """
    Compare a registered face and a captured face using DeepFace.
    Returns rich verification metadata including matched status, distance, threshold, and confidence.
    """
    return verify_face_pair(
        img1=known_image_path,
        img2=unknown_image_path,
        model_name=model_name,
        detector_backend=detector_backend,
        distance_metric="cosine",
        enforce_detection=True,
    )