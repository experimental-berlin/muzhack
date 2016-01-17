#!/usr/bin/env python3
import argparse
import os.path
import sys

root_dir = os.path.abspath(os.path.normpath(os.path.dirname(__file__)))
sys.path.insert(0, root_dir)

from _common import *

os.chdir(root_dir)

parser = argparse.ArgumentParser(
    description='Set up DigitalOcean node.')
parser.add_argument(
    'node_addr', help='Specify DigitalOcean node address')
args = parser.parse_args()

run_command([
    'scp', '_setup-do-node-after-bootstrap.py',
    'root@{}:/tmp/'.format(args.node_addr),
])
run_command([
    'scp', '_common.py',
    'root@{}:/tmp/'.format(args.node_addr),
])
run_command([
    'ssh', 'root@{}'.format(args.node_addr), 'apt-get update && '
    'DEBIAN_FRONTEND=noninteractive apt-get upgrade -o '
    'Dpkg::Options::="--force-confdef" -o Dpkg::Options::="--force-confold" '
    '-y && apt-get install -y python3 curl vim && apt-get autoremove -y '
    '&& python3 /tmp/_setup-do-node-after-bootstrap.py',
])
run_command(
    ['ssh', 'root@{}'.format(args.node_addr), 'reboot', ], ignore_error=True)
