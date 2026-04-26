import face_recognition # type: ignore

def compare_faces(known_image_path, unknown_image_path):
    """
    Compare a registered face and a captured face.
    Returns True if matched, otherwise False.
    """

    # Load images
    known_image = face_recognition.load_image_file(known_image_path)
    unknown_image = face_recognition.load_image_file(unknown_image_path)

    # Encode faces
    known_encodings = face_recognition.face_encodings(known_image)
    unknown_encodings = face_recognition.face_encodings(unknown_image)

    # Check if a face was detected
    if not known_encodings:
        return {"success": False, "message": "No face found in registered image."}

    if not unknown_encodings:
        return {"success": False, "message": "No face found in captured image."}

    # Compare first detected face
    match = face_recognition.compare_faces(
        [known_encodings[0]],
        unknown_encodings[0]
    )[0]

    if match:
        return {"success": True, "matched": True, "message": "Face matched."}
    else:
        return {"success": True, "matched": False, "message": "Face did not match."}