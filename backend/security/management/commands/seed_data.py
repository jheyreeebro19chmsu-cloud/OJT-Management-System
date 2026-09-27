import os
import io
import datetime
import qrcode
from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from django.utils import timezone
from django.core.files.base import ContentFile
from django.db import transaction

from security.models import (
    UserRole,
    Student,
    OJTInstructor,
    HTE,
    StudentOJTApplication,
    TimeRecord,
    Announcement,
    Task,
    StudentTask,
    FaceRegistration,
    HTEAccessRequest,
)

class Command(BaseCommand):
    help = "Populate the OJT Management System with comprehensive, realistic seed data."

    def add_arguments(self, parser):
        parser.add_argument(
            '--clear',
            action='store_true',
            help='Clear seeded records before populating (keeps existing superusers)'
        )

    def handle(self, *args, **options):
        clear_flag = options.get('clear', False)

        self.stdout.write(self.style.MIGRATE_HEADING("======================================================="))
        self.stdout.write(self.style.MIGRATE_HEADING("   CHMSU OJT MANAGEMENT SYSTEM - DATABASE SEEDER      "))
        self.stdout.write(self.style.MIGRATE_HEADING("======================================================="))

        with transaction.atomic():
            if clear_flag:
                self.stdout.write(self.style.WARNING("Clearing existing seeded transactional data..."))
                TimeRecord.objects.all().delete()
                StudentTask.objects.all().delete()
                Task.objects.all().delete()
                StudentOJTApplication.objects.all().delete()
                Announcement.objects.all().delete()
                HTEAccessRequest.objects.all().delete()

            # -------------------------------------------------------------
            # 1. ADMIN USER
            # -------------------------------------------------------------
            admin_email = "admin@chmsuojtmis.site"
            admin_user, created = User.objects.get_or_create(
                username=admin_email,
                defaults={
                    "email": admin_email,
                    "first_name": "System",
                    "last_name": "Administrator",
                    "is_staff": True,
                    "is_superuser": True,
                    "is_active": True,
                }
            )
            admin_user.set_password("Admin@12345")
            admin_user.is_staff = True
            admin_user.is_superuser = True
            admin_user.save()

            UserRole.objects.update_or_create(
                user=admin_user,
                defaults={"role": "instructor", "is_verified": True}
            )
            self.stdout.write(self.style.SUCCESS(f"[OK] Admin ready: {admin_email} (Password: Admin@12345)"))

            # Ensure default 'admin' user also exists for local tests
            local_admin, _ = User.objects.get_or_create(
                username="admin",
                defaults={"email": "admin@ojt.local", "first_name": "Admin", "last_name": "Local", "is_staff": True, "is_superuser": True}
            )
            local_admin.set_password("Admin@12345")
            local_admin.save()

            # -------------------------------------------------------------
            # 2. OJT INSTRUCTORS
            # -------------------------------------------------------------
            instructors_data = [
                {
                    "email": "instructor.it@chmsu.edu.ph",
                    "first_name": "Maria Elena",
                    "last_name": "Santos",
                    "course": "Bachelor of Science in Information Technology",
                    "department": "College of Computer Studies",
                    "institution": "Carlos Hilado Memorial State University - Talisay Main",
                },
                {
                    "email": "instructor.is@chmsu.edu.ph",
                    "first_name": "Roberto",
                    "last_name": "Tan",
                    "course": "Bachelor of Science in Information Systems",
                    "department": "College of Computer Studies",
                    "institution": "Carlos Hilado Memorial State University - Alijis Campus",
                }
            ]

            instructor_objs = []
            for item in instructors_data:
                u, _ = User.objects.get_or_create(
                    username=item["email"],
                    defaults={
                        "email": item["email"],
                        "first_name": item["first_name"],
                        "last_name": item["last_name"],
                        "is_active": True,
                    }
                )
                u.set_password("Instructor@12345")
                u.first_name = item["first_name"]
                u.last_name = item["last_name"]
                u.save()

                UserRole.objects.update_or_create(user=u, defaults={"role": "instructor", "is_verified": True})

                qr_data = f"instructor_{u.id}_{u.email}"
                qr = qrcode.QRCode(version=1, box_size=8, border=3)
                qr.add_data(qr_data)
                qr.make(fit=True)
                img_io = io.BytesIO()
                qr.make_image().save(img_io, format='PNG')
                img_io.seek(0)

                inst, _ = OJTInstructor.objects.update_or_create(
                    user=u,
                    defaults={
                        "course": item["course"],
                        "department": item["department"],
                        "institution": item["institution"],
                        "qr_code": qr_data,
                    }
                )
                inst.qr_code_image.save(f"qr_{u.id}.png", ContentFile(img_io.read()), save=True)
                instructor_objs.append(inst)
                self.stdout.write(self.style.SUCCESS(f"[OK] Instructor ready: {item['email']} (Password: Instructor@12345)"))

            # -------------------------------------------------------------
            # 3. HOST TRAINING ESTABLISHMENTS (HTEs)
            # -------------------------------------------------------------
            htes_data = [
                {
                    "email": "hte.techcorp@chmsuojtmis.site",
                    "company_name": "NexGen Digital Solutions Inc.",
                    "company_address": "4th Floor, Ayala Capitol Central, Bacolod City",
                    "barangay": "Barangay 8, Bacolod City",
                    "contact_person": "Engr. Alexander Vance",
                    "contact_phone": "+63 917 555 1234",
                    "first_name": "Alexander",
                    "last_name": "Vance",
                    "lat": 10.6765,
                    "lng": 122.9509,
                },
                {
                    "email": "hte.cyberhub@chmsuojtmis.site",
                    "company_name": "CyberHub IT Innovations & Labs",
                    "company_address": "Zone 2, Highway Talisay, Negros Occidental",
                    "barangay": "Zone 2, Talisay City",
                    "contact_person": "Ms. Karen Joy Villamor",
                    "contact_phone": "+63 920 888 5678",
                    "first_name": "Karen Joy",
                    "last_name": "Villamor",
                    "lat": 10.7411,
                    "lng": 122.9691,
                },
                {
                    "email": "hte.capitol@chmsuojtmis.site",
                    "company_name": "Negros Occidental Provincial Capitol - ICTD",
                    "company_address": "Gatuslao Street, Bacolod City",
                    "barangay": "Barangay 9, Bacolod City",
                    "contact_person": "Dir. Eduardo Ramos",
                    "contact_phone": "+63 34 433 2145",
                    "first_name": "Eduardo",
                    "last_name": "Ramos",
                    "lat": 10.6740,
                    "lng": 122.9515,
                }
            ]

            hte_objs = []
            for item in htes_data:
                u, _ = User.objects.get_or_create(
                    username=item["email"],
                    defaults={
                        "email": item["email"],
                        "first_name": item["first_name"],
                        "last_name": item["last_name"],
                        "is_active": True,
                    }
                )
                u.set_password("Hte@12345")
                u.first_name = item["first_name"]
                u.last_name = item["last_name"]
                u.save()

                UserRole.objects.update_or_create(user=u, defaults={"role": "hte", "is_verified": True})

                hte_record, _ = HTE.objects.update_or_create(
                    user=u,
                    defaults={
                        "company_name": item["company_name"],
                        "company_address": item["company_address"],
                        "barangay": item["barangay"],
                        "contact_person": item["contact_person"],
                        "contact_phone": item["contact_phone"],
                    }
                )
                hte_objs.append((hte_record, item))
                self.stdout.write(self.style.SUCCESS(f"[OK] HTE ready: {item['company_name']} ({item['email']}) (Password: Hte@12345)"))

            # -------------------------------------------------------------
            # 4. STUDENTS / TRAINEES
            # -------------------------------------------------------------
            students_data = [
                {
                    "email": "student.cruz@chmsu.edu.ph",
                    "student_id": "2023-00101",
                    "first_name": "Juan",
                    "last_name": "Cruz",
                    "age": 21,
                    "year_level": "4th Year",
                    "section": "BSIT 4-A",
                    "address": "Brgy. Bata, Bacolod City",
                    "school": "Carlos Hilado Memorial State University",
                    "instructor": instructor_objs[0],
                    "hte": hte_objs[0][0],
                    "hte_meta": hte_objs[0][1],
                    "status": "approved",
                    "rendered": 160.0,
                },
                {
                    "email": "student.reyes@chmsu.edu.ph",
                    "student_id": "2023-00102",
                    "first_name": "Alyssa",
                    "last_name": "Reyes",
                    "age": 22,
                    "year_level": "4th Year",
                    "section": "BSIT 4-A",
                    "address": "Brgy. Mandalagan, Bacolod City",
                    "school": "Carlos Hilado Memorial State University",
                    "instructor": instructor_objs[0],
                    "hte": hte_objs[1][0],
                    "hte_meta": hte_objs[1][1],
                    "status": "approved",
                    "rendered": 184.0,
                },
                {
                    "email": "student.garcia@chmsu.edu.ph",
                    "student_id": "2023-00103",
                    "first_name": "Mark Anthony",
                    "last_name": "Garcia",
                    "age": 21,
                    "year_level": "4th Year",
                    "section": "BSIT 4-B",
                    "address": "Brgy. Mansilingan, Bacolod City",
                    "school": "Carlos Hilado Memorial State University",
                    "instructor": instructor_objs[0],
                    "hte": hte_objs[2][0],
                    "hte_meta": hte_objs[2][1],
                    "status": "approved",
                    "rendered": 96.0,
                },
                {
                    "email": "student.flores@chmsu.edu.ph",
                    "student_id": "2023-00104",
                    "first_name": "Camille Anne",
                    "last_name": "Flores",
                    "age": 22,
                    "year_level": "4th Year",
                    "section": "BSIS 4-A",
                    "address": "Zone 12, Talisay City",
                    "school": "Carlos Hilado Memorial State University",
                    "instructor": instructor_objs[1],
                    "hte": hte_objs[0][0],
                    "hte_meta": hte_objs[0][1],
                    "status": "approved",
                    "rendered": 210.0,
                },
                {
                    "email": "student.delatorre@chmsu.edu.ph",
                    "student_id": "2023-00105",
                    "first_name": "John Paul",
                    "last_name": "Dela Torre",
                    "age": 23,
                    "year_level": "4th Year",
                    "section": "BSIT 4-B",
                    "address": "Brgy. Tangub, Bacolod City",
                    "school": "Carlos Hilado Memorial State University",
                    "instructor": instructor_objs[0],
                    "hte": hte_objs[1][0],
                    "hte_meta": hte_objs[1][1],
                    "status": "pending",
                    "rendered": 0.0,
                },
            ]

            student_objs = []
            today = timezone.now().date()
            start_date = today - datetime.timedelta(days=30)
            end_date = start_date + datetime.timedelta(days=90)

            for item in students_data:
                u, _ = User.objects.get_or_create(
                    username=item["email"],
                    defaults={
                        "email": item["email"],
                        "first_name": item["first_name"],
                        "last_name": item["last_name"],
                        "is_active": True,
                    }
                )
                u.set_password("Student@12345")
                u.first_name = item["first_name"]
                u.last_name = item["last_name"]
                u.save()

                UserRole.objects.update_or_create(user=u, defaults={"role": "student", "is_verified": True})

                stud, _ = Student.objects.update_or_create(
                    user=u,
                    defaults={
                        "student_id": item["student_id"],
                        "age": item["age"],
                        "year_level": item["year_level"],
                        "section": item["section"],
                        "address": item["address"],
                        "school": item["school"],
                    }
                )

                # Ensure face registration record placeholder exists
                FaceRegistration.objects.update_or_create(
                    employee_id=item["student_id"],
                    defaults={
                        "user": u,
                        "face_encoding": [0.05] * 128,
                    }
                )

                # Create OJT Application
                app, _ = StudentOJTApplication.objects.update_or_create(
                    student=stud,
                    company_name=item["hte_meta"]["company_name"],
                    defaults={
                        "instructor": item["instructor"],
                        "hte": item["hte"],
                        "company_address": item["hte_meta"]["company_address"],
                        "gps_latitude": item["hte_meta"]["lat"],
                        "gps_longitude": item["hte_meta"]["lng"],
                        "geofence_radius": 150.0,
                        "start_date": start_date,
                        "end_date": end_date,
                        "required_hours": 486,
                        "rendered_hours": item["rendered"],
                        "status": item["status"],
                        "approved_at": timezone.now() if item["status"] == "approved" else None,
                    }
                )

                student_objs.append((stud, app, item))
                self.stdout.write(self.style.SUCCESS(f"[OK] Student ready: {item['first_name']} {item['last_name']} ({item['email']})"))

                # -------------------------------------------------------------
                # 5. TIME RECORDS (DTR) for Approved Students
                # -------------------------------------------------------------
                if item["status"] == "approved":
                    # Generate 10 days of attendance
                    for day_offset in range(1, 11):
                        record_date = today - datetime.timedelta(days=day_offset)
                        # Skip weekends
                        if record_date.weekday() >= 5:
                            continue

                        # Morning session
                        t_in_morning = datetime.datetime.combine(
                            record_date, datetime.time(7, 55), tzinfo=datetime.timezone.utc
                        )
                        t_out_morning = datetime.datetime.combine(
                            record_date, datetime.time(12, 0), tzinfo=datetime.timezone.utc
                        )

                        TimeRecord.objects.get_or_create(
                            application=app,
                            student=stud,
                            date=record_date,
                            session="morning",
                            defaults={
                                "time_in": t_in_morning,
                                "time_out": t_out_morning,
                                "hours_rendered": 4.0,
                                "time_in_lat": item["hte_meta"]["lat"] + 0.00005,
                                "time_in_lng": item["hte_meta"]["lng"] + 0.00005,
                                "time_out_lat": item["hte_meta"]["lat"] + 0.00004,
                                "time_out_lng": item["hte_meta"]["lng"] + 0.00006,
                                "is_approved": True,
                                "notes": "Morning workstation shift completed.",
                            }
                        )

                        # Afternoon session
                        t_in_afternoon = datetime.datetime.combine(
                            record_date, datetime.time(13, 0), tzinfo=datetime.timezone.utc
                        )
                        t_out_afternoon = datetime.datetime.combine(
                            record_date, datetime.time(17, 0), tzinfo=datetime.timezone.utc
                        )

                        TimeRecord.objects.get_or_create(
                            application=app,
                            student=stud,
                            date=record_date,
                            session="afternoon",
                            defaults={
                                "time_in": t_in_afternoon,
                                "time_out": t_out_afternoon,
                                "hours_rendered": 4.0,
                                "time_in_lat": item["hte_meta"]["lat"] + 0.00005,
                                "time_in_lng": item["hte_meta"]["lng"] + 0.00005,
                                "time_out_lat": item["hte_meta"]["lat"] + 0.00004,
                                "time_out_lng": item["hte_meta"]["lng"] + 0.00006,
                                "is_approved": True,
                                "notes": "Afternoon tasks and project documentation.",
                            }
                        )

            self.stdout.write(self.style.SUCCESS("[OK] Realistic Daily Time Records (DTR) generated."))

            # -------------------------------------------------------------
            # 6. ANNOUNCEMENTS
            # -------------------------------------------------------------
            announcements_data = [
                {
                    "title": "Welcome to OJT Semester 2026-2027",
                    "content": "All trainees must ensure their geofence boundaries and facial recognition models are registered with their respective HTE coordinators before logging attendance.",
                    "instructor": instructor_objs[0],
                },
                {
                    "title": "Midterm OJT Progress Report Submission",
                    "content": "Please submit your signed weekly journals and supervisor evaluation forms via the student portal on or before next Friday.",
                    "instructor": instructor_objs[0],
                },
                {
                    "title": "Company Health & Cyber Security Safety Standards",
                    "content": "Strict adherence to partner establishment NDA and safety guidelines is required for all interns on-site.",
                    "instructor": instructor_objs[1],
                }
            ]

            for a in announcements_data:
                Announcement.objects.get_or_create(
                    title=a["title"],
                    instructor=a["instructor"],
                    defaults={"content": a["content"]}
                )
            self.stdout.write(self.style.SUCCESS("[OK] Department Announcements created."))

            # -------------------------------------------------------------
            # 7. TASKS & STUDENT TASKS
            # -------------------------------------------------------------
            tasks_data = [
                {
                    "title": "Submit Signed Memorandum of Agreement (MOA)",
                    "description": "Upload scanned copy of your signed tripartite agreement with HTE partner.",
                    "due_date": timezone.now() + datetime.timedelta(days=7),
                    "instructor": instructor_objs[0],
                },
                {
                    "title": "Weekly Progress Journal #1",
                    "description": "Document your workstation onboarding, systems access, and technical tasks accomplished.",
                    "due_date": timezone.now() + datetime.timedelta(days=14),
                    "instructor": instructor_objs[0],
                }
            ]

            for t_data in tasks_data:
                task, _ = Task.objects.get_or_create(
                    title=t_data["title"],
                    instructor=t_data["instructor"],
                    defaults={
                        "description": t_data["description"],
                        "due_date": t_data["due_date"],
                    }
                )
                for stud, app, _ in student_objs:
                    StudentTask.objects.get_or_create(
                        student=stud,
                        task=task,
                        defaults={
                            "status": "submitted" if stud.student_id == "2023-00101" else "in_progress",
                            "feedback": "Good progress on onboarding." if stud.student_id == "2023-00101" else "",
                        }
                    )
            self.stdout.write(self.style.SUCCESS("[OK] OJT Academic Tasks and Submissions populated."))

            # -------------------------------------------------------------
            # 8. HTE ACCESS REQUESTS
            # -------------------------------------------------------------
            if student_objs:
                HTEAccessRequest.objects.get_or_create(
                    hte=hte_objs[0][0],
                    application=student_objs[0][1],
                    defaults={
                        "status": "approved",
                        "approved_at": timezone.now(),
                    }
                )
                if len(student_objs) > 1:
                    HTEAccessRequest.objects.get_or_create(
                        hte=hte_objs[1][0],
                        application=student_objs[1][1],
                        defaults={
                            "status": "pending",
                        }
                    )
            self.stdout.write(self.style.SUCCESS("[OK] HTE Access Requests created."))

        self.stdout.write(self.style.MIGRATE_HEADING("======================================================="))
        self.stdout.write(self.style.SUCCESS("  DATABASE SEEDING COMPLETED SUCCESSFULLY!"))
        self.stdout.write(self.style.MIGRATE_HEADING("======================================================="))
        self.stdout.write("Credentials Summary:")
        self.stdout.write("  - Admin:      admin@chmsuojtmis.site  / Admin@12345")
        self.stdout.write("  - Instructor: instructor.it@chmsu.edu.ph / Instructor@12345")
        self.stdout.write("  - HTE Coord:  hte.techcorp@chmsuojtmis.site / Hte@12345")
        self.stdout.write("  - Student:    student.cruz@chmsu.edu.ph / Student@12345")
        self.stdout.write("=======================================================\n")
