#!/usr/bin/env python3
import rethinkdb as r
from pprint import pprint
import json
import argparse
import sys


def _error(msg):
    sys.stderr.write('{}\n'.format(msg))
    sys.exit(1)


parser = argparse.ArgumentParser(
    description='Insert project store items into RethinkDB database')
parser.add_argument('input', help='Input JSON file')
parser.add_argument(
    '--host', default='localhost', help='Specify RethinkDB host')
args = parser.parse_args()

with open(args.input, 'rb') as f:
    data = json.loads(f.read().decode())

conn = r.connect(host=args.host, db='muzhack')
for project_data in data:
    print('Going to insert store items for project {}:'.format(
        project_data['id']))
    pprint(project_data['items'][0])
    result = r.table('projects').get(project_data['id']).update({
        'storeItems': project_data['items'],
    }).run(conn)
    if result['errors'] > 0:
        _error('Database update failed: {}'.format(result['first_error']))
        sys.exit(1)

    print('Updated project:')
    projects = r.table('projects').run(conn)
    pprint(list(projects))
