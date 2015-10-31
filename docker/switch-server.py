#!/usr/bin/env python3
import argparse
import subprocess

parser = argparse.ArgumentParser()
parser.add_argument('server', choices=['blue', 'green',],
    help='Specify server to switch to')
args = parser.parse_args()

server = 'muzhack-{}'.format(args.server)

subprocess.check_call(['tutum', 'service', 'set', '--link', '{0}:{0}'.format(server), 'lb'],
    stdout=subprocess.PIPE)
print('* Successfully switched production server to {}'.format(server))
