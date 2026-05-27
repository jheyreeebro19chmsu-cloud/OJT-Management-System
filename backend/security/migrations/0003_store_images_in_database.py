from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('security', '0002_otpverification_attendancephoto_face_verified_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='faceregistration',
            name='image_data',
            field=models.BinaryField(blank=True, null=True, help_text='Image stored as binary data in database'),
        ),
        migrations.AddField(
            model_name='faceregistration',
            name='image_format',
            field=models.CharField(default='jpeg', help_text='Image format: jpeg, png, etc.', max_length=10),
        ),
        migrations.AddField(
            model_name='faceregistration',
            name='updated_at',
            field=models.DateTimeField(auto_now=True),
        ),
        migrations.AlterField(
            model_name='faceregistration',
            name='image',
            field=models.ImageField(blank=True, null=True, upload_to='face_registrations/'),
        ),
        migrations.AddField(
            model_name='attendancephoto',
            name='image_data',
            field=models.BinaryField(blank=True, null=True, help_text='Image stored as binary data in database'),
        ),
        migrations.AddField(
            model_name='attendancephoto',
            name='image_format',
            field=models.CharField(default='jpeg', help_text='Image format: jpeg, png, etc.', max_length=10),
        ),
        migrations.AlterField(
            model_name='attendancephoto',
            name='image',
            field=models.ImageField(blank=True, null=True, upload_to='attendance_photos/'),
        ),
    ]
