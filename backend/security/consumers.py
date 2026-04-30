import json
import base64
import cv2
import numpy as np
import face_recognition
from channels.generic.websocket import AsyncWebsocketConsumer
from asgiref.sync import sync_to_async
from .models import FaceRegistration

class FaceProcessConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.employee_id = self.scope['url_route']['kwargs']['employee_id']
        await self.accept()
        
        # Load registered face encoding
        self.known_encoding = await self.get_registered_encoding(self.employee_id)
        
        if self.known_encoding is None:
            await self.send(text_data=json.dumps({
                'error': 'No registered face found for this employee.'
            }))

    async def disconnect(self, close_code):
        pass

    async def receive(self, text_data):
        data = json.loads(text_data)
        image_data = data.get('image')
        
        if not image_data or self.known_encoding is None:
            return

        # Process frame
        matched, distance = await self.process_frame(image_data)
        
        await self.send(text_data=json.dumps({
            'matched': matched,
            'distance': distance,
            'confidence': max(0.0, 1.0 - distance)
        }))

    @sync_to_async
    def get_registered_encoding(self, employee_id):
        reg = FaceRegistration.objects.filter(employee_id=employee_id).first()
        if reg and reg.face_encoding:
            return np.array(reg.face_encoding)
        return None

    @sync_to_async
    def process_frame(self, base64_image):
        try:
            # Decode image
            format, imgstr = base64_image.split(';base64,')
            data = base64.b64decode(imgstr)
            np_arr = np.frombuffer(data, np.uint8)
            img = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
            rgb_img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
            
            # Find face encodings in current frame
            face_encodings = face_recognition.face_encodings(rgb_img)
            
            if not face_encodings:
                return False, 1.0
            
            # Compare with known encoding
            distance = face_recognition.face_distance([self.known_encoding], face_encodings[0])[0]
            matched = distance < 0.6 # Default tolerance
            
            return bool(matched), float(distance)
        except Exception as e:
            print(f"WS Process Error: {e}")
            return False, 1.0
