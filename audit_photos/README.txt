Place your actual photos here for live unmocked testing:
  - baseline.jpg    (Clean bare face for template reference)
  - blink.jpg       (Photo of your face with eyes closed — mandatory server liveness)
  - bare.jpg        (Clean face shot 2 to verify genuine match)
  - eyeglasses.jpg  (Wearing regular glasses)
  - sunglasses.jpg  (Wearing dark sunglasses)
  - cap.jpg         (Wearing cap/hat)
  - mask.jpg        (Wearing face mask)
  - low_light.jpg   (Shot in dim/dark room)
  - off_angle.jpg   (Face turned at 45 degrees)

Run audit command:
  python scripts/audit_real_photos.py --dir audit_photos
