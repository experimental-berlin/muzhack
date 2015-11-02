#!/usr/bin/env python3
import argparse
import subprocess
import json
import sys


parser = argparse.ArgumentParser()
args = parser.parse_args()


def _info(msg):
    sys.stdout.write('* {}\n'.format(msg))
    sys.stdout.flush()


def _run_tutum(args):
    try:
        subprocess.check_call(['tutum',] + args, stdout=subprocess.PIPE)
    except subprocess.CalledProcessError as err:
        sys.stderr.write('{}\n'.format(err))
        sys.exit(1)


_info('Determining current production details...')
output = subprocess.check_output(['tutum', 'service', 'inspect', 'lb.muzhack-staging']).decode(
    'utf-8')
data = json.loads(output)
linked_service = data['linked_to_service'][0]['name']
_info('Currently linked service is \'{}\''.format(linked_service))

if linked_service == 'muzhack-green':
    link_to = 'muzhack-blue'
else:
    assert linked_service == 'muzhack-blue'
    link_to = 'muzhack-green'

_info('Redeploying service \'{}\'...'.format(link_to))
_run_tutum(['service', 'redeploy', '--sync', link_to,])

_info('Linking to service \'{}\'...'.format(link_to))
_run_tutum(['service', 'set', '--link-service', '{0}:{0}'.format(link_to),
    '--sync', 'lb.muzhack-staging',])
_info('Successfully switched production service to {}'.format(link_to))
