#!/usr/bin/env python3
"""Back up RethinkDB periodically."""
import asyncio
import sys
import contextlib
import logging
import subprocess
import os.path
import argparse
import daemon


os.chdir(os.path.abspath(os.path.dirname(__file__)))

cl_parser = argparse.ArgumentParser(description='Back up RethinkDB')
cl_parser.add_argument('--host', help='Database host', default='localhost')
cl_parser.add_argument(
    '--file', help='Backup archive path', default='./rethinkdb-dump.tar.gz')
args = cl_parser.parse_args()


logging.basicConfig(format='%(asctime)s %(message)s', level=logging.INFO)
_logger = logging.getLogger()


def _do_backup():
    _logger.info('Backing up...')
    # subprocess.check_call([
    #     'rethinkdb', 'dump', '-c', args.host, '-f', args.file,
    # ])
    subprocess.check_call(['./_upload-archive.py', args.file])

    delay = 60*60*24
    _logger.info(
        'Scheduling next backup in {} hours...'.format(int(delay/(60*60))))
    loop.call_later(delay, _do_backup)


with daemon.DaemonContext(
    detach_process=False, stdout=sys.stdout, stderr=sys.stderr
):
    with contextlib.closing(asyncio.get_event_loop()) as loop:
        _do_backup()
        try:
            loop.run_forever()
        except KeyboardInterrupt:
            sys.exit(0)
