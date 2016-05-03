#!/usr/bin/env python2
import cloudstorage as gcs
from datetime import datetime
import contextlib
import logging
import argparse


logging.basicConfig(format='%(asctime)s %(message)s', level=logging.INFO)
_logger = logging.getLogger()

cl_parser = argparse.ArgumentParser(
    description='Upload RethinkDB archive to Google Cloud Storage')
cl_parser.add_argument('file', help='Backup archive path')
args = cl_parser.parse_args()

gcs.set_default_retry_params(gcs.RetryParams(
    initial_delay=0.2, max_delay=5.0, backoff_factor=2,
    max_retry_period=15))

bucket_name = 'backup.muzhack.com'
date_str = datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%S')
gcs_filename = '/{}/rethinkdb-dump-{}.tar.gz'.format(bucket_name, date_str)

write_retry_params = gcs.RetryParams(backoff_factor=1.1)
_logger.info(
    'Uploading archive to Cloud Storage: \'{}\'...'.format(gcs_filename))
with contextlib.closing(gcs.open(
    gcs_filename, 'w', options={
        'x-goog-meta-type': 'RethinkDB dump',
    },
    retry_params=write_retry_params
)) as gcs_file:
    with open(args.file, 'rb') as f:
        while True:
            block = f.read(8192)
            if not block:
                break
            gcs_file.write(block)

_logger.info('Successfully uploaded archive!')
