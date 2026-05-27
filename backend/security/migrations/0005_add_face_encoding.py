from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('security', '0004_merge_20260527_1421'),
    ]

    operations = [
        migrations.AddField(
            model_name='faceregistration',
            name='face_encoding',
            field=models.JSONField(blank=True, null=True, help_text='Stored as a list of 128 floats'),
        ),
    ]
