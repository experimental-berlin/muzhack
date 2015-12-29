#!/usr/bin/env python
import subprocess
import argparse
import os


parser = argparse.ArgumentParser(description='Back up local RethinkDB instance')
args = parser.parse_args()

command = ['rethinkdb', 'dump',]
auth_key = os.environ.get('RETHINKDB_AUTH_KEY')
if auth_key:
    command.extend(['-a', auth_key,])
subprocess.check_call(command)
