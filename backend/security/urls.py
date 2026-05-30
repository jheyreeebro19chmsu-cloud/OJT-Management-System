from django.urls import path
from . import views, auth_views, attendance_views, application_views, announcement_views

urlpatterns = [
    # Security/Face/Geofence endpoints
    path("health/", views.health, name="health"),
    path("geofence/check/", views.check_geofence, name="check_geofence"),
    path("geonames/proxy/", views.geonames_proxy, name="geonames_proxy"),
    path("geonames/countries/", views.geonames_countries, name="geonames_countries"),
    path("geonames/cities/", views.geonames_cities, name="geonames_cities"),
    path("osm/streets/", views.osm_streets, name="osm_streets"),
    path("face/register/", views.register_face, name="register_face"),
    path("face/enroll/", views.enroll_face, name="enroll_face"),
    path("face/verify/", views.verify_face, name="verify_face"),
    path("attendance/photo/", views.save_attendance_photo, name="save_attendance_photo"),
    path("mobile/register/", views.mobile_register, name="mobile_register"),
    path("email/send/", views.send_email, name="send_email"),
    
    # Authentication & Registration endpoints
    path("auth/request-otp/", auth_views.request_otp, name="request_otp"),
    path("auth/verify-otp/", auth_views.verify_otp, name="verify_otp"),
    path("auth/login/", auth_views.login, name="login"),
    path("auth/supabase-exchange/", auth_views.supabase_exchange, name="supabase_exchange"),
    path("auth/register-student/", auth_views.register_student, name="register_student"),
    path("auth/register-instructor/", auth_views.register_instructor, name="register_instructor"),
    path("auth/register-hte/", auth_views.register_hte, name="register_hte"),
    path("auth/reset-password/", auth_views.reset_password, name="reset_password"),
    path("auth/check-email/", auth_views.check_email, name="check_email"),
    
    # Attendance endpoints
    path("auth/verify-qr/", attendance_views.verify_qr, name="verify_qr"),
    path("attendance/time-in/", attendance_views.time_in, name="time_in"),
    path("attendance/time-out/", attendance_views.time_out, name="time_out"),
    
    # OJT Application endpoints
    path("application/submit/", application_views.submit_ojt_application, name="submit_application"),
    path("application/approve/", application_views.approve_ojt_application, name="approve_application"),
    path("application/reject/", application_views.reject_ojt_application, name="reject_application"),
    path("instructor/applications/", application_views.get_instructor_applications, name="get_instructor_applications"),
    path("application/my-status/", application_views.get_my_application_status, name="get_my_application_status"),
    path("instructor/time-records/", application_views.get_application_time_records, name="get_application_time_records"),
    
    # Announcement endpoints
    path("announcement/post/", announcement_views.post_announcement, name="post_announcement"),
    path("announcement/list/", announcement_views.get_announcements, name="get_announcements"),
    path("announcement/submit/", announcement_views.submit_announcement_response, name="submit_announcement_response"),
    
    # HTE Access endpoints
    path("hte/request-access/", application_views.request_hte_access, name="request_hte_access"),
    path("hte/approve-access/", application_views.approve_hte_access, name="approve_hte_access"),
    path("hte/reject-access/", application_views.reject_hte_access, name="reject_hte_access"),
    # HTE monitoring endpoints
    path("hte/applications/", application_views.get_hte_applications, name="get_hte_applications"),
    path("hte/time-records/", attendance_views.get_hte_time_records, name="get_hte_time_records"),
    path("hte/access-requests/", application_views.get_hte_access_requests, name="get_hte_access_requests"),
    path("hte/registrations/", attendance_views.get_hte_registrations, name="get_hte_registrations"),
    path("hte/dashboard/", application_views.get_hte_dashboard, name="get_hte_dashboard"),
]
