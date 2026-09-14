from flask import Flask, request, jsonify
from flask_cors import CORS
from geofence_checker import check_geofence
from face_recognition_checker import compare_faces
import os

app = Flask(__name__)
CORS(app)

ZONE_LAT = 14.6547
ZONE_LNG = 121.0493
RADIUS = 300

@app.route("/")
def home():
    return "Flask backend is running."

@app.route("/check-location", methods=["POST"])
def check_location():
    data = request.json

    user_lat = data["lat"]
    user_lng = data["lng"]

    inside = check_geofence(user_lat, user_lng, ZONE_LAT, ZONE_LNG, RADIUS)

    if inside:
        return jsonify({"status": "allowed"})
    else:
        return jsonify({"status": "outside"})

@app.route("/check-face", methods=["POST"])
def check_face():
    """
    Verify captured face against registered face using DeepFace.
    Expects:
    - registered_image: saved official image (file upload or base64)
    - captured_image: live captured image (file upload or base64)
    - model_name: optional (default: VGG-Face, supports Facenet, ArcFace, etc.)
    - detector_backend: optional (default: opencv)
    """

    registered_image = request.files.get("registered_image")
    captured_image = request.files.get("captured_image")
    model_name = request.form.get("model_name", "VGG-Face")
    detector_backend = request.form.get("detector_backend", "opencv")

    if not registered_image or not captured_image:
        return jsonify({"error": "Both registered_image and captured_image are required."}), 400

    os.makedirs("temp", exist_ok=True)

    registered_path = os.path.join("temp", "registered.jpg")
    captured_path = os.path.join("temp", "captured.jpg")

    registered_image.save(registered_path)
    captured_image.save(captured_path)

    result = compare_faces(
        registered_path,
        captured_path,
        model_name=model_name,
        detector_backend=detector_backend
    )

    return jsonify(result)

@app.route("/analyze-face", methods=["POST"])
def analyze_face():
    """
    Analyze facial attributes (age, gender, emotion) using DeepFace.
    Expects:
    - image: captured face image
    """
    from deepface_service import analyze_face_attributes

    image = request.files.get("image")
    if not image:
        return jsonify({"error": "Image file is required."}), 400

    os.makedirs("temp", exist_ok=True)
    temp_path = os.path.join("temp", "analyze_temp.jpg")
    image.save(temp_path)

    analysis = analyze_face_attributes(temp_path)
    return jsonify(analysis)

if __name__ == "__main__":
    app.run(debug=True)