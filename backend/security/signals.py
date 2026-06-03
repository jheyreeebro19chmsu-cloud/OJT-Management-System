from django.db.models.signals import post_save
from django.dispatch import receiver
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from django.conf import settings
from PIL import Image
import io
import os

from .models import TraineeOTPRequest
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer


def _make_thumbnail(image_file, size=(256, 256)):
    image = Image.open(image_file)
    image.convert("RGB")
    image.thumbnail(size)
    buf = io.BytesIO()
    image.save(buf, format="JPEG")
    buf.seek(0)
    return buf


@receiver(post_save, sender=TraineeOTPRequest)
def populate_avatar_metadata(sender, instance: TraineeOTPRequest, **kwargs):
    # Only act if there's an avatar file
    avatar_field = instance.avatar
    if not avatar_field or not avatar_field.name:
        return

    avatar_name = avatar_field.name

    # If avatar_key already set and matches, assume processed
    if instance.avatar_key and instance.avatar_key == avatar_name and instance.avatar_url:
        return

    # Prepare keys
    avatar_key = avatar_name

    # Generate thumbnail and save to storage
    try:
        avatar_field.open()
        thumb_buf = _make_thumbnail(avatar_field.file)
        # derive thumbnail key
        base, ext = os.path.splitext(avatar_name)
        thumb_key = f"{base}_thumb.jpg"
        # Save thumbnail via default storage
        content = ContentFile(thumb_buf.read())
        default_storage.save(thumb_key, content)
        # Build URL using storage if possible
        try:
            avatar_url = default_storage.url(avatar_key)
        except Exception:
            avatar_url = instance.face_photo_url if hasattr(instance, 'face_photo_url') and instance.face_photo_url else ''

        # Update fields in DB without triggering signals
        sender.objects.filter(pk=instance.pk).update(
            avatar_key=avatar_key,
            thumbnail_key=thumb_key,
            avatar_url=avatar_url,
        )
    except Exception:
        # Silently ignore failures to avoid blocking saves; logging can be added
        return


@receiver(post_save, sender=TraineeOTPRequest)
def notify_pending_count_change(sender, instance: TraineeOTPRequest, **kwargs):
    """Notify instructor websocket group about pending requests count changes."""
    try:
        channel_layer = get_channel_layer()
        if not channel_layer:
            return
        instructor = getattr(instance, 'instructor', None)
        if not instructor:
            return
        # Compute current pending count
        from .models import TraineeOTPRequest as TR
        count = TR.objects.filter(instructor=instructor, status='pending').count()
        group_name = f"instructor_{instructor.id}"
        async_to_sync(channel_layer.group_send)(
            group_name,
            {
                'type': 'pending_requests_update',
                'count': count,
                'action': getattr(instance, 'status', None),
            }
        )
    except Exception:
        # don't raise from signal
        return
