Deploy notes: creating Supabase `face-photos` bucket

1) GitHub Actions
- Workflow file: `.github/workflows/create-supabase-bucket.yml`
- Add the following repository secrets in GitHub: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (Service Role key).
- The workflow can be run manually (Actions > Create Supabase 'face-photos' bucket) or will run on pushes to `main`.

2) Render
- Add environment variables in your Render service settings: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.
- Set the "Start Command" for the web service to:

  sh backend/scripts/render_startup.sh

- The script will attempt to create the `face-photos` bucket (if it doesn't exist) before starting the app. It tolerates failures so service will still boot.

3) CI Notes
- The Python script uses the Supabase Storage Admin API at `/storage/v1/admin/buckets`, which requires a Service Role key.
- Keep `SUPABASE_SERVICE_ROLE_KEY` secret and only in server/CI environments.

4) Troubleshooting
- If the bucket already exists the script prints the public URL prefix and exits successfully.
- If you use a private bucket, update your backend to generate signed URLs instead of the public prefix.
