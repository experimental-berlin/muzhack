#!/usr/bin/env python
import subprocess
import argparse
import os.path
import sys
from datetime import datetime
import boto3


def _info(msg):
    sys.stdout.write('* {}\n'.format(msg))
    sys.stdout.flush()


s3_client = boto3.client('s3')
parser = argparse.ArgumentParser(description='Back up local RethinkDB instance')
parser.add_argument('--s3-bucket', default=None, help='Specify S3 bucket')
args = parser.parse_args()

date_time_str = datetime.utcnow().strftime('%Y-%m-%dT%H:%M')
filename = 'rethinkdb-dump-{}.tar.gz'.format(date_time_str)
bucket_name = ''
if os.path.exists(filename):
    os.remove(filename)
command = ['rethinkdb', 'dump', '-f', filename]
auth_key = os.environ.get('RETHINKDB_AUTH_KEY')
if auth_key:
    command.extend(['-a', auth_key,])
_info('Backing up database to {}...'.format(filename))
subprocess.check_call(command, stdout=subprocess.PIPE)

if args.s3_bucket:
    _info('Uploading {} to S3 bucket {}...'.format(filename, args.s3_bucket))
    # Upload the file to S3
    s3_client.upload_file(filename, bucket_name, filename)
    # TODO: Implement S3 uploading and deleting backups that are older than 100 days
