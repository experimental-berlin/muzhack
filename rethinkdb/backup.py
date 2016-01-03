#!/usr/bin/env python3
import subprocess
import argparse
import os.path
import sys
from datetime import datetime
import boto3


def _info(msg):
    sys.stdout.write('* {}\n'.format(msg))
    sys.stdout.flush()


def _error(msg):
    sys.stderr.write('* {}\n'.format(msg))
    sys.exit(1)


def _get_environment_value(key):
    value = (os.environ.get(key) or '').strip()
    if not value:
        _error('You must define environment value \'{}\''.format(key))
    return value


parser = argparse.ArgumentParser(description='Back up local RethinkDB instance')
parser.add_argument('--s3-bucket', default=None, help='Specify S3 bucket')
parser.add_argument('--remove', action='store_true', default=False,
    help='Remove backup archive when done?')
args = parser.parse_args()

date_time_str = datetime.utcnow().strftime('%Y-%m-%dT%H:%M')
filename = 'rethinkdb-dump-{}.tar.gz'.format(date_time_str)
if os.path.exists(filename):
    os.remove(filename)
command = ['rethinkdb', 'dump', '-f', filename]
auth_key = os.environ.get('RETHINKDB_AUTH_KEY')
if auth_key:
    command.extend(['-a', auth_key,])
_info('Backing up database to {}...'.format(filename))
subprocess.check_call(command, stdout=subprocess.PIPE)

if args.s3_bucket:
    _info('Uploading \'{}\' to S3 bucket \'{}\'...'.format(filename, args.s3_bucket))
    access_key_id = _get_environment_value('AWS_ACCESS_KEY_ID')
    secret = _get_environment_value('AWS_SECRET_ACCESS_KEY')
    s3_client = boto3.client('s3', region_name='eu-central-1', aws_access_key_id=access_key_id,
        aws_secret_access_key=secret)
    s3_client.upload_file(filename, args.s3_bucket, filename)
    # TODO: Implement deleting backups that are older than 100 days

if args.remove:
    os.remove(filename)

_info('Success!')
