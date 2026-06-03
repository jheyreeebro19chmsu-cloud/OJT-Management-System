from django.core.management.base import BaseCommand
import os
import boto3
from botocore.exceptions import ClientError


class Command(BaseCommand):
    help = 'Create the media bucket in S3/MinIO if it does not exist'

    def handle(self, *args, **options):
        endpoint = os.environ.get('MINIO_ENDPOINT') or os.environ.get('AWS_S3_ENDPOINT_URL')
        access_key = os.environ.get('MINIO_ACCESS_KEY') or os.environ.get('AWS_ACCESS_KEY_ID')
        secret_key = os.environ.get('MINIO_SECRET_KEY') or os.environ.get('AWS_SECRET_ACCESS_KEY')
        bucket = os.environ.get('MINIO_BUCKET') or os.environ.get('AWS_STORAGE_BUCKET_NAME')
        region = os.environ.get('MINIO_REGION') or os.environ.get('AWS_S3_REGION_NAME') or 'us-east-1'

        if not bucket:
            self.stderr.write('No bucket configured (MINIO_BUCKET / AWS_STORAGE_BUCKET_NAME).')
            return

        session = boto3.session.Session()
        s3 = session.client(
            service_name='s3',
            aws_access_key_id=access_key,
            aws_secret_access_key=secret_key,
            endpoint_url=endpoint,
            region_name=region,
        )

        try:
            s3.head_bucket(Bucket=bucket)
            self.stdout.write(f'Bucket "{bucket}" already exists.')
        except ClientError:
            try:
                s3.create_bucket(Bucket=bucket)
                self.stdout.write(f'Created bucket "{bucket}"')
            except Exception as e:
                self.stderr.write(f'Failed to create bucket: {e}')
