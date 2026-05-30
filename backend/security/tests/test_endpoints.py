from django.test import TestCase, Client
import json
from django.contrib.auth.models import User
from rest_framework_simplejwt.tokens import RefreshToken
import base64
from ..models import Student, OJTInstructor, StudentOJTApplication, FaceRegistration
from django.utils import timezone


class ApplicationStatusEnrollTests(TestCase):
    def setUp(self):
        self.client = Client()
        # create a user and student profile
        self.user = User.objects.create_user(username='testuser', email='student@example.com', password='pass1234')
        self.student = Student.objects.create(user=self.user)

        # create an instructor for application relation
        self.instructor_user = User.objects.create_user(username='inst', email='inst@example.com', password='pass1234')
        self.instructor = OJTInstructor.objects.create(user=self.instructor_user)

        # create an application
        self.app = StudentOJTApplication.objects.create(
            student=self.student,
            instructor=self.instructor,
            company_name='Test Co',
            company_address='123 Test St',
            gps_latitude=10.0,
            gps_longitude=10.0,
            geofence_radius=100,
            start_date=timezone.now().date(),
            end_date=timezone.now().date(),
            required_hours=40,
            status='pending'
        )

    def _auth_header(self, user):
        refresh = RefreshToken.for_user(user)
        access = str(refresh.access_token)
        return {'HTTP_AUTHORIZATION': f'Bearer {access}'}

    def test_get_my_application_status(self):
        url = '/api/application/my-status/'
        resp = self.client.get(url, **self._auth_header(self.user))
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertTrue(data.get('success'))
        app = data.get('application')
        self.assertIsNotNone(app)
        self.assertEqual(app.get('status'), 'pending')

    def test_enroll_face(self):
        url = '/api/face/enroll/'
        # use a minimal valid 1x1 PNG base64
        png_b64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII='
        payload = 'data:image/png;base64,' + png_b64
        # Call view directly to avoid JWT decorator complexity in tests
        from django.test import RequestFactory
        from .. import views

        factory = RequestFactory()
        request = factory.post(url, data=json.dumps({'captured_image': payload}), content_type='application/json')
        # attach Authorization header so require_jwt can validate
        refresh = RefreshToken.for_user(self.user)
        access = str(refresh.access_token)
        request.META['HTTP_AUTHORIZATION'] = f'Bearer {access}'

        resp = views.enroll_face(request)
        # If JsonResponse object returned directly from view, parse content
        status = getattr(resp, 'status_code', 200)
        if hasattr(resp, 'json'):
            data = resp.json()
        else:
            data = json.loads(resp.content.decode())
        self.assertIn(status, (200, 201))
        self.assertTrue(data.get('success'))

        # verify FaceRegistration exists
        fr = FaceRegistration.objects.filter(user=self.user).first()
        self.assertIsNotNone(fr)
        self.assertTrue(fr.image_data is not None or fr.image)
