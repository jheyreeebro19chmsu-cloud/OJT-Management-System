from django.urls import path

from . import views, auth_views

urlpatterns = [
    # Security/Face/Geofence endpoints
    path("health/", views.health, name="health"),
    path("geofence/check/", views.check_geofence, name="check_geofence"),
    path("face/register/", views.register_face, name="register_face"),
    path("face/verify/", views.verify_face, name="verify_face"),
    path("attendance/photo/", views.save_attendance_photo, name="save_attendance_photo"),
    
    # Authentication endpoints
    path("auth/request-otp/", auth_views.request_otp, name="request_otp"),
    path("auth/verify-otp/", auth_views.verify_otp, name="verify_otp"),
    path("auth/register-student/", auth_views.register_student, name="register_student"),
    path("auth/register-instructor/", auth_views.register_instructor, name="register_instructor"),
    path("auth/register-hte/", auth_views.register_hte, name="register_hte"),
    path("auth/login/", auth_views.login, name="login"),
    
    # OJT Application endpoints
    path("application/submit/", auth_views.submit_ojt_application, name="submit_application"),
    path("application/approve/", auth_views.approve_ojt_application, name="approve_application"),
    path("application/reject/", auth_views.reject_ojt_application, name="reject_application"),
    
    # Time tracking endpoints
    path("attendance/time-in/", auth_views.time_in, name="time_in"),
    path("attendance/time-out/", auth_views.time_out, name="time_out"),
    
    # Announcement endpoints
    path("announcement/post/", auth_views.post_announcement, name="post_announcement"),
    path("announcement/list/", auth_views.get_announcements, name="get_announcements"),
    
    # HTE Access endpoints
    path("hte/request-access/", auth_views.request_hte_access, name="request_hte_access"),
    path("hte/approve-access/", auth_views.approve_hte_access, name="approve_hte_access"),
    path("hte/reject-access/", auth_views.reject_hte_access, name="reject_hte_access"),
    # HTE monitoring endpoints
    path("hte/applications/", auth_views.get_hte_applications, name="get_hte_applications"),
    path("hte/time-records/", auth_views.get_hte_time_records, name="get_hte_time_records"),
    path("hte/access-requests/", auth_views.get_hte_access_requests, name="get_hte_access_requests"),
    path("hte/registrations/", auth_views.get_hte_registrations, name="get_hte_registrations"),
    path("hte/dashboard/", auth_views.get_hte_dashboard, name="get_hte_dashboard"),
]
