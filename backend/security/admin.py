from django.contrib import admin

from .models import (
    UserRole, Student, OJTInstructor, HTE, OTPVerification,
    StudentOJTApplication, TimeRecord, Announcement, Task,
    StudentTask, FaceRegistration, AttendancePhoto,
    HTEAccessRequest
)


@admin.register(UserRole)
class UserRoleAdmin(admin.ModelAdmin):
    list_display = ("get_user_full_name", "get_user_email", "role", "is_verified", "created_at")
    search_fields = ("user__email", "user__first_name", "user__last_name")
    list_filter = ("role", "is_verified", "created_at")
    readonly_fields = ("created_at", "updated_at")
    
    def get_user_full_name(self, obj):
        return obj.user.get_full_name()
    get_user_full_name.short_description = "Name"
    
    def get_user_email(self, obj):
        return obj.user.email
    get_user_email.short_description = "Email"


@admin.register(Student)
class StudentAdmin(admin.ModelAdmin):
    list_display = ("get_user_email", "get_user_name", "age", "year_level", "section")
    search_fields = ("user__email", "user__first_name", "user__last_name")
    readonly_fields = ("created_at", "updated_at")
    
    def get_user_email(self, obj):
        return obj.user.email
    get_user_email.short_description = "Email"
    
    def get_user_name(self, obj):
        return obj.user.get_full_name()
    get_user_name.short_description = "Name"


@admin.register(OJTInstructor)
class OJTInstructorAdmin(admin.ModelAdmin):
    list_display = ("get_user_email", "get_user_name", "course", "department", "institution")
    search_fields = ("user__email", "user__first_name", "user__last_name", "course", "department")
    readonly_fields = ("created_at", "updated_at", "qr_code_image")
    
    def get_user_email(self, obj):
        return obj.user.email
    get_user_email.short_description = "Email"
    
    def get_user_name(self, obj):
        return obj.user.get_full_name()
    get_user_name.short_description = "Name"


@admin.register(HTE)
class HTEAdmin(admin.ModelAdmin):
    list_display = ("get_user_email", "company_name", "company_address", "contact_person")
    search_fields = ("user__email", "company_name", "contact_person")
    readonly_fields = ("created_at", "updated_at")
    
    def get_user_email(self, obj):
        return obj.user.email
    get_user_email.short_description = "Email"


@admin.register(OTPVerification)
class OTPVerificationAdmin(admin.ModelAdmin):
    list_display = ("email", "is_verified", "created_at", "expires_at")
    search_fields = ("email",)
    list_filter = ("is_verified", "created_at")
    readonly_fields = ("created_at",)


@admin.register(StudentOJTApplication)
class StudentOJTApplicationAdmin(admin.ModelAdmin):
    list_display = ("get_student_name", "get_instructor_name", "company_name", "status", "created_at")
    search_fields = ("student__user__email", "instructor__user__email", "company_name")
    list_filter = ("status", "created_at", "start_date", "end_date")
    readonly_fields = ("created_at", "updated_at", "approved_at")
    
    def get_student_name(self, obj):
        return obj.student.user.get_full_name()
    get_student_name.short_description = "Student"
    
    def get_instructor_name(self, obj):
        return obj.instructor.user.get_full_name()
    get_instructor_name.short_description = "Instructor"


@admin.register(TimeRecord)
class TimeRecordAdmin(admin.ModelAdmin):
    list_display = ("get_student_name", "date", "time_in", "time_out", "hours_rendered", "is_approved")
    search_fields = ("student__user__email", "student__user__first_name", "student__user__last_name")
    list_filter = ("date", "is_approved", "created_at")
    readonly_fields = ("created_at", "updated_at")
    
    def get_student_name(self, obj):
        return obj.student.user.get_full_name()
    get_student_name.short_description = "Student"


@admin.register(Announcement)
class AnnouncementAdmin(admin.ModelAdmin):
    list_display = ("title", "get_instructor_name", "created_at")
    search_fields = ("title", "content", "instructor__user__email")
    list_filter = ("created_at",)
    readonly_fields = ("created_at", "updated_at")
    
    def get_instructor_name(self, obj):
        return obj.instructor.user.get_full_name()
    get_instructor_name.short_description = "Instructor"


@admin.register(Task)
class TaskAdmin(admin.ModelAdmin):
    list_display = ("title", "get_instructor_name", "due_date", "created_at")
    search_fields = ("title", "description", "instructor__user__email")
    list_filter = ("due_date", "created_at")
    readonly_fields = ("created_at", "updated_at")
    
    def get_instructor_name(self, obj):
        return obj.instructor.user.get_full_name()
    get_instructor_name.short_description = "Instructor"


@admin.register(StudentTask)
class StudentTaskAdmin(admin.ModelAdmin):
    list_display = ("get_student_name", "get_task_title", "status", "submitted_at")
    search_fields = ("student__user__email", "task__title")
    list_filter = ("status", "submitted_at")
    readonly_fields = ("submitted_at", "graded_at")
    
    def get_student_name(self, obj):
        return obj.student.user.get_full_name()
    get_student_name.short_description = "Student"
    
    def get_task_title(self, obj):
        return obj.task.title
    get_task_title.short_description = "Task"


@admin.register(FaceRegistration)
class FaceRegistrationAdmin(admin.ModelAdmin):
    list_display = ("employee_id", "get_user_email", "created_at")
    search_fields = ("employee_id", "user__email")
    readonly_fields = ("created_at",)
    
    def get_user_email(self, obj):
        return obj.user.email if obj.user else "N/A"
    get_user_email.short_description = "User Email"


@admin.register(AttendancePhoto)
class AttendancePhotoAdmin(admin.ModelAdmin):
    list_display = ("employee_id", "action", "geofence_verified", "face_verified", "created_at")
    list_filter = ("action", "geofence_verified", "face_verified", "created_at")
    search_fields = ("employee_id",)
    readonly_fields = ("created_at",)


@admin.register(HTEAccessRequest)
class HTEAccessRequestAdmin(admin.ModelAdmin):
    list_display = ("get_hte_company", "get_student_name", "status", "requested_at")
    search_fields = ("hte__company_name", "application__student__user__email")
    list_filter = ("status", "requested_at")
    readonly_fields = ("requested_at", "approved_at")
    
    def get_hte_company(self, obj):
        return obj.hte.company_name
    get_hte_company.short_description = "HTE Company"
    
    def get_student_name(self, obj):
        return obj.application.student.user.get_full_name()
    get_student_name.short_description = "Student"
