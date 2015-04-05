#!/usr/bin/env python3
import pymongo
import subprocess
import re
from datetime import datetime
import argparse
from json import load as load_json
import sys


def _info(msg):
    sys.stdout.write(msg + '\n')
    sys.stdout.flush()


cl_parser = argparse.ArgumentParser(description='Insert a project into Meteor\'s local MongoDB')
cl_parser.add_argument('input', help='JSON input file')
cl_parser.add_argument('--site', default=None, help='Specify Meteor site (default: localhost)')
args = cl_parser.parse_args()

with open(args.input) as input_file:
    json = load_json(input_file)

command = ['meteor', 'mongo', '-U']
if args.site:
    command.append(args.site)
_info('Getting Mongo URL...')
mongo_url = subprocess.check_output(command).decode().strip()
db_name = mongo_url.rsplit('/', 1)[1]
_info('Connecting to MongoDB: {}'.format(mongo_url))
client = pymongo.MongoClient(mongo_url)
db = client[db_name]

project = {
    'created': datetime.utcnow(),
    'owner': json['owner'],
    'projectId': json['id'],
    'tags': json['tags'],
    'text': json['description'],
    'title': json['title'],
    'instructions': json['instructions'],
    'pictures': json['pictures'],
    'files': json['files'],
    'license': json['license'],
    'zipFile': json['zipFile'],
}
db.projects.update({'owner': project['owner'], 'projectId': project['projectId']}, project,
    upsert=True)
_info('Successfully inserted project \'{}/{}\' ({})'.format(
    project['owner'],
    project['projectId'],
    project['title'],
))
