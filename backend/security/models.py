from django.db import models
from django.contrib.auth.models import User
from django.utils import timezone
from datetime import timedelta
import random
import string


# UserRole tracking model
class UserRole(models.Model):
    ROLE_CHOICES = [
        ('student', 'Student'),
        ('instructor', 'OJT Instructor'),
        ('hte', 'Host Training Establishment'),
    ]
    
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='role_profile')
    role = models.CharField(max_length=20, choices=ROLE_CHOICES)
    is_verified = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    def __str__(self):
        return f"{self.user.get_full_name()} ({self.get_role_display()})"


class Student(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='student_profile')
    age = models.IntegerField(null=True, blank=True)
    address = models.TextField(blank=True)
    year_level = models.CharField(max_length=50, blank=True)
    section = models.CharField(max_length=50, blank=True)
    school = models.CharField(max_length=255, blank=True)
    student_id = models.CharField(max_length=100, unique=True, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    def __str__(self):
        return f"Student: {self.user.get_full_name()}"


class OJTInstructor(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='instructor_profile')
    course = models.CharField(max_length=255, blank=True)
    department = models.CharField(max_length=255, blank=True)
    institution = models.CharField(max_length=255, blank=True)
    qr_code = models.TextField(blank=True, help_text="QR code data for student enrollment")
    qr_code_image = models.ImageField(upload_to='instructor_qrcodes/', null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    def __str__(self):
        return f"Instructor: {self.user.get_full_name()}"


class HTE(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='hte_profile')
    company_name = models.CharField(max_length=255)
    company_address = models.TextField()
    contact_person = models.CharField(max_length=255, blank=True)
    contact_phone = models.CharField(max_length=20, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    def __str__(self):
        return f"HTE: {self.company_name}"


class OTPVerification(models.Model):
    email = models.EmailField()
    otp_code = models.CharField(max_length=6)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    is_verified = models.BooleanField(default=False)
    
    def is_valid(self):
        return not self.is_verified and timezone.now() < self.expires_at
    
    @staticmethod
    def generate_otp():
        return ''.join(random.choices(string.digits, k=6))
    
    @staticmethod
    def create_otp(email):
        otp_code = OTPVerification.generate_otp()
        expires_at = timezone.now() + timedelta(minutes=10)
        otp = OTPVerification.objects.create(
            email=email,
            otp_code=otp_code,
            expires_at=expires_at
        )
        return otp
    
    def __str__(self):
        return f"OTP for {self.email}"


class StudentOJTApplication(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
        ('completed', 'Completed'),
        ('cancelled', 'Cancelled'),
    ]
    
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='ojt_applications')
    instructor = models.ForeignKey(OJTInstructor, on_delete=models.CASCADE, related_name='applications')
    hte = models.ForeignKey(HTE, on_delete=models.CASCADE, related_name='applications', null=True, blank=True)
    
    company_name = models.CharField(max_length=255)
    company_address = models.TextField()
    gps_latitude = models.FloatField()
    gps_longitude = models.FloatField()
    geofence_radius = models.FloatField(default=100.0, help_text="Radius in meters")
    
    start_date = models.DateField()
    end_date = models.DateField()
    required_hours = models.IntegerField(help_text="Total hours required")
    rendered_hours = models.FloatField(default=0.0)
    
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    rejection_reason = models.TextField(blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    approved_at = models.DateTimeField(null=True, blank=True)
    
    def __str__(self):
        return f"OJT Application: {self.student.user.get_full_name()} at {self.company_name}"
    
    @property
    def is_completed(self):
        return self.rendered_hours >= self.required_hours
    
    @property
    def remaining_hours(self):
        return max(0, self.required_hours - self.rendered_hours)


class TimeRecord(models.Model):
    application = models.ForeignKey(StudentOJTApplication, on_delete=models.CASCADE, related_name='time_records')
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='time_records')
    
    time_in = models.DateTimeField(null=True, blank=True)
    time_out = models.DateTimeField(null=True, blank=True)
    hours_rendered = models.FloatField(default=0.0)
    date = models.DateField()
    # session: morning or afternoon
    SESSION_CHOICES = [
        ('morning', 'Morning'),
        ('afternoon', 'Afternoon'),
        ('unspecified', 'Unspecified'),
    ]
    session = models.CharField(max_length=20, choices=SESSION_CHOICES, default='unspecified')
    
    notes = models.TextField(blank=True)
    is_approved = models.BooleanField(default=False)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    def __str__(self):
        return f"TimeRecord: {self.student.user.get_full_name()} on {self.date}"
    
    @property
    def calculate_hours(self):
        if self.time_in and self.time_out:
            delta = self.time_out - self.time_in
            self.hours_rendered = delta.total_seconds() / 3600.0
        return self.hours_rendered


class Announcement(models.Model):
    instructor = models.ForeignKey(OJTInstructor, on_delete=models.CASCADE, related_name='announcements')
    title = models.CharField(max_length=255)
    content = models.TextField()
    image = models.ImageField(upload_to='announcements/', null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-created_at']
    
    def __str__(self):
        return f"Announcement: {self.title}"


class AnnouncementSubmission(models.Model):
    announcement = models.ForeignKey(Announcement, on_delete=models.CASCADE, related_name='submissions')
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='announcement_submissions')
    message = models.TextField(blank=True)
    image = models.ImageField(upload_to='announcement_submissions/', null=True, blank=True)
    submitted_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"AnnouncementSubmission({self.announcement.id} by {self.student.user.get_full_name()})"


class Task(models.Model):
    STATUS_CHOICES = [
        ('open', 'Open'),
        ('in_progress', 'In Progress'),
        ('completed', 'Completed'),
        ('overdue', 'Overdue'),
    ]
    
    instructor = models.ForeignKey(OJTInstructor, on_delete=models.CASCADE, related_name='tasks')
    title = models.CharField(max_length=255)
    description = models.TextField()
    due_date = models.DateTimeField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    def __str__(self):
        return f"Task: {self.title}"


class StudentTask(models.Model):
    STATUS_CHOICES = [
        ('not_started', 'Not Started'),
        ('in_progress', 'In Progress'),
        ('submitted', 'Submitted'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
    ]
    
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='student_tasks')
    task = models.ForeignKey(Task, on_delete=models.CASCADE, related_name='student_tasks')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='not_started')
    submission_file = models.FileField(upload_to='task_submissions/', null=True, blank=True)
    feedback = models.TextField(blank=True)
    submitted_at = models.DateTimeField(null=True, blank=True)
    graded_at = models.DateTimeField(null=True, blank=True)
    
    def __str__(self):
        return f"{self.student.user.get_full_name()} - {self.task.title}"


class FaceRegistration(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='face_registration', null=True, blank=True)
    employee_id = models.CharField(max_length=64, unique=True)
    image = models.ImageField(upload_to="face_registrations/", null=True, blank=True)
    # Store image binary data directly in database
    image_data = models.BinaryField(null=True, blank=True, help_text="Image stored as binary data in database")
    image_format = models.CharField(max_length=10, default='jpeg', help_text="Image format: jpeg, png, etc.")
    face_encoding = models.JSONField(null=True, blank=True, help_text="Stored as a list of 128 floats")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self) -> str:
        return f"FaceRegistration({self.employee_id})"


class AttendancePhoto(models.Model):
    ACTION_CHOICES = [
        ("in", "Time In"),
        ("out", "Time Out"),
    ]

    employee_id = models.CharField(max_length=64)
    application = models.ForeignKey(StudentOJTApplication, on_delete=models.CASCADE, related_name='attendance_photos', null=True, blank=True)
    action = models.CharField(max_length=8, choices=ACTION_CHOICES)
    image = models.ImageField(upload_to="attendance_photos/", null=True, blank=True)
    # Store image binary data directly in database
    image_data = models.BinaryField(null=True, blank=True, help_text="Image stored as binary data in database")
    image_format = models.CharField(max_length=10, default='jpeg', help_text="Image format: jpeg, png, etc.")
    geofence_verified = models.BooleanField(default=False)
    face_verified = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self) -> str:
        return f"AttendancePhoto({self.employee_id}, {self.action})"


class HTEAccessRequest(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
    ]
    
    hte = models.ForeignKey(HTE, on_delete=models.CASCADE, related_name='access_requests')
    application = models.ForeignKey(StudentOJTApplication, on_delete=models.CASCADE, related_name='hte_access_requests')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    requested_at = models.DateTimeField(auto_now_add=True)
    approved_at = models.DateTimeField(null=True, blank=True)
    rejection_reason = models.TextField(blank=True)
    
    def __str__(self):
        return f"HTE Access Request: {self.hte.company_name} - {self.status}"
