#!/usr/bin/env python3
import argparse
import subprocess
import json
import sys


parser = argparse.ArgumentParser(
    description='Update production server to latest Docker image.')
args = parser.parse_args()


def _info(msg):
    sys.stdout.write('* {}\n'.format(msg))
    sys.stdout.flush()


def _run_docker_cloud(args):
    try:
        subprocess.check_call(['docker-cloud', ] + args, stdout=subprocess.PIPE)
    except subprocess.CalledProcessError as err:
        sys.stderr.write('{}\n'.format(err))
        sys.exit(1)


def _inspect_service(service):
    output = subprocess.check_output([
        'docker-cloud', 'service', 'inspect', '{}.muzhack-staging'.format(service),
    ]).decode('utf-8')
    return json.loads(output)


_info('Determining current production details...')
data = _inspect_service('lb')
linked_service = data['linked_to_service'][0]['name']
_info('Currently linked service is \'{}\''.format(linked_service))

if linked_service == 'muzhack-green':
    link_to = 'muzhack-blue'
else:
    assert linked_service == 'muzhack-blue'
    link_to = 'muzhack-green'

_info('Redeploying service \'{}\'...'.format(link_to))
_run_docker_cloud(['service', 'redeploy', '--sync', link_to, ])

_info('Linking to service \'{}\'...'.format(link_to))
_run_docker_cloud([
    'service', 'set', '--link-service', '{0}:{0}'.format(link_to),
    '--sync', 'lb.muzhack-staging',
])
_info('Successfully switched production service to {}'.format(link_to))
