#!/usr/bin/env python3
"""
Standalone InsightFace Biometric Verification Script.
Uses ArcFace buffalo_s model pack with ONNX Runtime and Cosine Similarity (threshold: 0.45).
"""

import sys
import os
import argparse
import numpy as np

# Add backend directory to sys.path
backend_dir = os.path.dirname(os.path.abspath(__file__))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from insightface_service import (
    verify_attendance,
    get_face_embedding,
    is_insightface_available
)


def verify_face_match(scanned_img, registered_profile_img, match_threshold=0.45):
    """
    Verifies that the scanned face matches the registered profile photo using InsightFace.
    Returns: dict(success=bool, match=bool, similarity=float, distance=float, message=str)
    """
    if not is_insightface_available():
        print("[Error] InsightFace is not installed or available in this environment.")
        return {
            "success": False,
            "match": False,
            "similarity": 0.0,
            "message": "InsightFace is not available."
        }

    result = verify_attendance(
        scanned_img=scanned_img,
        registered_profile_img_or_emb=registered_profile_img,
        match_threshold=match_threshold
    )

    print("\n" + "=" * 55)
    print("           INSIGHTFACE VERIFICATION LOG")
    print("=" * 55)
    print(f"Model Architecture  : {result.get('model', 'ArcFace (buffalo_s)')}")
    print(f"Cosine Similarity   : {result.get('similarity', 0.0):.4f}")
    print(f"Cosine Distance     : {result.get('distance', 1.0):.4f}")
    print(f"Match Threshold     : {match_threshold:.2f}")
    print(f"Confidence Score    : {result.get('confidence', 0.0) * 100:.1f}%")
    print(f"Biometric Match     : {'[PASSED] MATCH' if result.get('matched') else '[REJECTED] MISMATCH'}")
    print(f"Message             : {result.get('message')}")
    print("=" * 55 + "\n")

    return result


def main():
    parser = argparse.ArgumentParser(
        description="InsightFace Biometric Verification with Strict Cosine Threshold"
    )
    parser.add_argument("scanned_image", help="Path to captured/scanned face image")
    parser.add_argument("profile_image", help="Path to registered profile face image")
    parser.add_argument(
        "--threshold",
        type=float,
        default=0.45,
        help="Strict cosine similarity threshold (default: 0.45, genuine: >=0.45, mismatch: <0.40)"
    )

    args = parser.parse_args()

    if not os.path.exists(args.scanned_image):
        print(f"[Error] Scanned image not found: {args.scanned_image}")
        sys.exit(1)
    if not os.path.exists(args.profile_image):
        print(f"[Error] Profile image not found: {args.profile_image}")
        sys.exit(1)

    result = verify_face_match(args.scanned_image, args.profile_image, match_threshold=args.threshold)
    sys.exit(0 if result.get("matched") else 1)


if __name__ == "__main__":
    main()
