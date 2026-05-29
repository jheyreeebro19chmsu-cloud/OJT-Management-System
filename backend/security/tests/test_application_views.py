from django.test import TestCase, Client
from django.contrib.auth.models import User
from rest_framework_simplejwt.tokens import RefreshToken
from ..models import OJTInstructor, Student, StudentOJTApplication, UserRole
import json
from datetime import date, timedelta

class ApplicationViewsTest(TestCase):
    def setUp(self):
        self.client = Client()
        # Create instructor user
        self.instructor_user = User.objects.create_user(username='inst@example.com', email='inst@example.com', password='pass')
        self.instructor = OJTInstructor.objects.create(user=self.instructor_user, course='IT')
        UserRole.objects.create(user=self.instructor_user, role='instructor', is_verified=True)

        # Create student user
        self.student_user = User.objects.create_user(username='stud@example.com', email='stud@example.com', password='pass')
        self.student = Student.objects.create(user=self.student_user, age=20, address='Addr')

        # Create several applications
        for i in range(25):
            StudentOJTApplication.objects.create(
                student=self.student,
                instructor=self.instructor,
                company_name=f'Company {i}',
                company_address='Addr',
                gps_latitude=0.0,
                gps_longitude=0.0,
                geofence_radius=100,
                start_date=date.today(),
                end_date=date.today()+timedelta(days=30),
                required_hours=100
            )

        # Create another user (not instructor)
        self.other_user = User.objects.create_user(username='other@example.com', email='other@example.com', password='pass')

        # Tokens
        self.instructor_token = str(RefreshToken.for_user(self.instructor_user).access_token)
        self.other_token = str(RefreshToken.for_user(self.other_user).access_token)

    def test_instructor_applications_pagination(self):
        # Request first page
        resp = self.client.get('/api/instructor/applications/?page=1&page_size=10', HTTP_AUTHORIZATION=f'Bearer {self.instructor_token}')
        self.assertEqual(resp.status_code, 200)
        data = json.loads(resp.content)
        self.assertTrue(data.get('success'))
        self.assertEqual(len(data.get('applications', [])), 10)
        self.assertEqual(data.get('page'), 1)
        self.assertEqual(data.get('page_size'), 10)
        self.assertEqual(data.get('total'), 25)

        # Search by company
        resp2 = self.client.get('/api/instructor/applications/?q=Company%201', HTTP_AUTHORIZATION=f'Bearer {self.instructor_token}')
        self.assertEqual(resp2.status_code, 200)
        data2 = json.loads(resp2.content)
        self.assertTrue(data2.get('success'))
        # At least one result contains Company 1
        self.assertTrue(any('Company 1' in a.get('company_name', '') for a in data2.get('applications', [])))

    def test_approve_reject_authorization(self):
        # pick an application
        app = StudentOJTApplication.objects.first()
        # other user (not instructor) cannot approve
        resp = self.client.post('/api/application/approve/', json.dumps({'application_id': app.id}), content_type='application/json', HTTP_AUTHORIZATION=f'Bearer {self.other_token}')
        self.assertEqual(resp.status_code, 403)

        # instructor can approve
        resp2 = self.client.post('/api/application/approve/', json.dumps({'application_id': app.id}), content_type='application/json', HTTP_AUTHORIZATION=f'Bearer {self.instructor_token}')
        self.assertEqual(resp2.status_code, 200)
        app.refresh_from_db()
        self.assertEqual(app.status, 'approved')

        # instructor can reject another
        app2 = StudentOJTApplication.objects.exclude(id=app.id).first()
        resp3 = self.client.post('/api/application/reject/', json.dumps({'application_id': app2.id, 'rejection_reason': 'Not suitable'}), content_type='application/json', HTTP_AUTHORIZATION=f'Bearer {self.instructor_token}')
        self.assertEqual(resp3.status_code, 200)
        app2.refresh_from_db()
        self.assertEqual(app2.status, 'rejected')