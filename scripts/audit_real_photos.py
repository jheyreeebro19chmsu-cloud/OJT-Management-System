#!/usr/bin/env python3
"""
Empirical Face Recognition & Occlusion Audit CLI
Hits the live verify_face endpoint with REAL photos (no mocks, no synthetic blank drawings).

Usage:
  # 1. Test a directory of photos (e.g. audit_photos/):
  python scripts/audit_real_photos.py --dir audit_photos --reference audit_photos/baseline.jpg

  # 2. Test a single pair:
  python scripts/audit_real_photos.py --reference my_face.jpg --test my_face_with_cap.jpg --label "Cap Occlusion"

Supported Photo Naming Convention in audit directory:
  - baseline.jpg / reference.jpg  (Clean bare face for template enrollment)
  - bare.jpg                      (Clean bare face to verify genuine match)
  - eyeglasses.jpg                (Prescription / reading glasses)
  - sunglasses.jpg                (Dark / mirrored shades)
  - cap.jpg / hat.jpg             (Baseball cap / beanie / fedora)
  - mask.jpg                      (Surgical / KN95 / fabric mask)
  - low_light.jpg / dark.jpg      (Dimly lit room)
  - off_angle.jpg                 (Head turned 45 degrees)
"""

import os
import sys
import argparse
import base64
import json
import time
from pathlib import Path

try:
    import requests
except ImportError:
    print("[!] 'requests' library required. Run: pip install requests")
    sys.exit(1)


def file_to_data_url(file_path: str) -> str:
    ext = Path(file_path).suffix.lower().lstrip('.')
    mime = 'jpeg' if ext in ('jpg', 'jpeg') else ext
    with open(file_path, 'rb') as f:
        encoded = base64.b64encode(f.read()).decode('utf-8')
    return f"data:image/{mime};base64,{encoded}"


def run_audit(reference_path: str, test_files: list, backend_url: str, api_key: str, blink_path: str = None):
    print("\n" + "=" * 80)
    print("  LIVE EMPIRICAL FACIAL RECOGNITION AUDIT (UNMOCKED)")
    print(f"  Backend:        {backend_url}")
    print(f"  Reference Face: {reference_path}")
    if blink_path:
        print(f"  Liveness Proof: {blink_path} (Mandatory closed-eye frame)")
    else:
        print("  Liveness Proof: NONE (Warning: server strictly requires blink_image)")
    print("=" * 80 + "\n")

    if not os.path.exists(reference_path):
        print(f"[ERROR] Reference photo not found: {reference_path}")
        sys.exit(1)

    ref_data_url = file_to_data_url(reference_path)
    blink_data_url = file_to_data_url(blink_path) if blink_path and os.path.exists(blink_path) else None

    if not blink_data_url:
        print("[!] NOTICE: No blink photo provided or detected.")
        print("    The backend strictly enforces mandatory server-side liveness proof.")
        print("    Requests omitting blink_image will be rejected with HTTP 422 'liveness_required'.\n")

    verify_url = f"{backend_url.rstrip('/')}/api/security/face/verify/"
    headers = {
        'Content-Type': 'application/json',
        'X-API-Key': api_key,
        'Authorization': f'Bearer {api_key}',
    }

    results = []

    for label, test_path in test_files:
        if not os.path.exists(test_path):
            print(f"[-] Skipping {label}: file '{test_path}' does not exist.")
            continue

        print(f"[*] Submitting: {label} ({Path(test_path).name})...", end="", flush=True)
        test_data_url = file_to_data_url(test_path)

        payload = {
            'registered_image': ref_data_url,
            'captured_image': test_data_url,
        }
        if blink_data_url:
            payload['blink_image'] = blink_data_url

        start_t = time.time()
        try:
            res = requests.post(verify_url, json=payload, headers=headers, timeout=20)
            duration = time.time() - start_t
            status_code = res.status_code

            try:
                body = res.json()
            except Exception:
                body = {'raw': res.text[:200]}

            matched = body.get('matched', False)
            distance = body.get('distance')
            tolerance = body.get('tolerance', 0.6)
            quality_status = body.get('status', 'n/a')
            liveness_verified = body.get('liveness_verified', False)

            if liveness_verified:
                live_str = "PASS"
            elif body.get('status') == 'liveness_required':
                live_str = "MISSING"
            elif body.get('status') == 'liveness_failed':
                live_str = "FAIL"
            elif body.get('status') == 'liveness_error':
                live_str = "ERR"
            else:
                live_str = "—"

            results.append({
                'label': label,
                'file': Path(test_path).name,
                'http_code': status_code,
                'matched': matched,
                'liveness': live_str,
                'distance': f"{distance:.3f}" if isinstance(distance, (int, float)) else "—",
                'tolerance': f"{tolerance:.2f}" if isinstance(tolerance, (int, float)) else "—",
                'quality': quality_status,
                'message': body.get('message', ''),
                'duration': f"{duration:.2f}s"
            })
            print(f" Done ({status_code}) [{duration:.2f}s]")

        except requests.exceptions.RequestException as req_err:
            print(f" FAILED: {req_err}")
            results.append({
                'label': label,
                'file': Path(test_path).name,
                'http_code': "ERR",
                'matched': False,
                'liveness': "ERR",
                'distance': "—",
                'tolerance': "—",
                'quality': "network_error",
                'message': str(req_err),
                'duration': "—"
            })

    # Print Formatted Results Table
    print("\n" + "=" * 115)
    print(f"{'Condition / Label':<22} | {'HTTP':<5} | {'Live':<7} | {'Match':<6} | {'Dist':<6} | {'Quality':<14} | {'Message'}")
    print("-" * 115)

    for r in results:
        match_str = "YES" if r['matched'] else "NO"
        http_str = str(r['http_code'])
        msg_short = (r['message'][:40] + '...') if len(r['message']) > 40 else r['message']
        print(f"{r['label']:<22} | {http_str:<5} | {r['liveness']:<7} | {match_str:<6} | {r['distance']:<6} | {r['quality']:<14} | {msg_short}")

    print("=" * 115 + "\n")
    print("[✓] Audit run complete. Real unmocked evidence recorded above.\n")


def main():
    parser = argparse.ArgumentParser(description="Live Empirical Face Verification Security Audit")
    parser.add_argument("--backend-url", default=os.getenv("BACKEND_URL", "http://localhost:8000"), help="Backend URL")
    parser.add_argument("--api-key", default=os.getenv("SECURITY_API_KEY", "default-security-api-key"), help="Security API Key")
    parser.add_argument("--dir", help="Directory containing test photos")
    parser.add_argument("--reference", help="Path to clean reference photo")
    parser.add_argument("--blink", help="Path to closed-eyes liveness photo (mandatory for server liveness)")
    parser.add_argument("--test", help="Path to single test photo")
    parser.add_argument("--label", default="Test Photo", help="Label for single test photo")

    args = parser.parse_args()

    if args.dir:
        dir_path = Path(args.dir)
        if not dir_path.is_dir():
            print(f"[!] Directory does not exist: {args.dir}")
            sys.exit(1)

        # Detect reference photo
        ref = args.reference
        if not ref:
            for candidate in ("baseline.jpg", "reference.jpg", "bare.jpg", "baseline.png", "reference.png"):
                p = dir_path / candidate
                if p.exists():
                    ref = str(p)
                    break

        if not ref:
            print("[!] Could not auto-detect reference photo in directory. Specify with --reference <path>.")
            sys.exit(1)

        # Detect blink photo for mandatory server liveness
        blink = args.blink
        if not blink:
            for candidate in ("blink.jpg", "blink.png", "blink.jpeg", "closed_eyes.jpg", "closed_eyes.png"):
                p = dir_path / candidate
                if p.exists():
                    blink = str(p)
                    break

        known_patterns = [
            ("Bare Face (Clean)", ["bare.jpg", "bare.png", "clean.jpg"]),
            ("Eyeglasses", ["eyeglasses.jpg", "glasses.jpg", "reading_glasses.jpg"]),
            ("Sunglasses", ["sunglasses.jpg", "shades.jpg", "dark_glasses.jpg"]),
            ("Hat / Cap", ["cap.jpg", "hat.jpg", "baseball_cap.jpg", "beanie.jpg"]),
            ("Face Mask", ["mask.jpg", "face_mask.jpg", "surgical_mask.jpg"]),
            ("Low Light / Dim", ["dark.jpg", "low_light.jpg", "dim.jpg"]),
            ("Off-Angle / Profile", ["off_angle.jpg", "angle.jpg", "side.jpg"]),
            ("Blurry / Motion", ["blurry.jpg", "blur.jpg"]),
        ]

        test_files = []
        for label, names in known_patterns:
            for name in names:
                f = dir_path / name
                if f.exists():
                    test_files.append((label, str(f)))
                    break

        # Also add any remaining image files not matched above (exclude ref and blink)
        excluded_paths = {p for _, p in test_files}
        if ref:
            excluded_paths.add(str(Path(ref).resolve()))
            excluded_paths.add(str(ref))
        if blink:
            excluded_paths.add(str(Path(blink).resolve()))
            excluded_paths.add(str(blink))

        for f in dir_path.glob("*.*"):
            if f.suffix.lower() in ('.jpg', '.jpeg', '.png', '.webp'):
                f_str = str(f)
                f_resolved = str(f.resolve())
                if f_str not in excluded_paths and f_resolved not in excluded_paths:
                    test_files.append((f.stem.replace('_', ' ').title(), f_str))

        run_audit(ref, test_files, args.backend_url, args.api_key, blink_path=blink)

    elif args.reference and args.test:
        test_files = [(args.label, args.test)]
        run_audit(args.reference, test_files, args.backend_url, args.api_key, blink_path=args.blink)
    else:
        # Create default instructions if invoked without arguments
        default_dir = Path("audit_photos")
        default_dir.mkdir(exist_ok=True)
        readme = default_dir / "README.txt"
        with open(readme, "w") as f:
            f.write(
                "Place your actual photos here for live unmocked testing:\n"
                "  - baseline.jpg    (Clean bare face for template reference)\n"
                "  - blink.jpg       (Photo of your face with eyes closed — mandatory server liveness)\n"
                "  - bare.jpg        (Clean face shot 2 to verify genuine match)\n"
                "  - eyeglasses.jpg  (Wearing regular glasses)\n"
                "  - sunglasses.jpg  (Wearing dark sunglasses)\n"
                "  - cap.jpg         (Wearing cap/hat)\n"
                "  - mask.jpg        (Wearing face mask)\n"
                "  - low_light.jpg   (Shot in dim/dark room)\n"
                "  - off_angle.jpg   (Face turned at 45 degrees)\n\n"
                "Run audit command:\n"
                "  python scripts/audit_real_photos.py --dir audit_photos\n"
            )
        print("\n[i] 'audit_photos/' directory initialized.")
        print("To run the unmocked audit against real photos:")
        print("  1. Drop your photos into 'audit_photos/' (e.g. baseline.jpg, blink.jpg, eyeglasses.jpg, cap.jpg, mask.jpg)")
        print("  2. Run: python scripts/audit_real_photos.py --dir audit_photos\n")


if __name__ == "__main__":
    main()
