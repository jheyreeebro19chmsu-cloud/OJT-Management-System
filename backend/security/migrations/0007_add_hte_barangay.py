from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('security', '0006_otpauditlog'),
    ]

    operations = [
        migrations.AddField(
            model_name='hte',
            name='barangay',
            field=models.CharField(blank=True, help_text='Barangay / Barangay name', max_length=255),
        ),
    ]
