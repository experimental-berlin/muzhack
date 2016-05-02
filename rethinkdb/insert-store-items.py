#!/usr/bin/env python3
import rethinkdb as r
import json
import argparse
import sys


def _error(msg):
    sys.stderr.write('{}\n'.format(msg))
    sys.exit(1)


def _info(msg):
    sys.stdout.write('* {}\n'.format(msg))
    sys.stdout.flush()


parser = argparse.ArgumentParser(
    description='Insert project store items into RethinkDB database')
parser.add_argument('input', help='Input JSON file')
parser.add_argument(
    '--host', default='localhost', help='Specify RethinkDB host')
parser.add_argument(
    '--auth', '-a', help='Specify RethinkDB authentication key')
args = parser.parse_args()

with open(args.input, 'rb') as f:
    data = json.loads(f.read().decode())

conn = r.connect(host=args.host, db='muzhack', auth_key=args.auth or '')
for project_data in data:
    _info('Inserting items into project \'{}\''.format(project_data['id']))
    result = r.table('projects').get(project_data['id']).update({
        'storeItems': project_data['items'],
    }).run(conn)
    if result['errors'] > 0:
        _error('Database update failed: {}'.format(result['first_error']))
        sys.exit(1)

_info('Success!')
