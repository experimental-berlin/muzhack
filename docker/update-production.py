#!/usr/bin/env python3
import argparse
import subprocess
import json
import sys


parser = argparse.ArgumentParser()
args = parser.parse_args()


def info(msg):
    sys.stdout.write('* {}\n'.format(msg))
    sys.stdout.flush()

info('Determining current production details...')
output = subprocess.check_output(['tutum', 'service', 'inspect', 'lb.muzhack-staging']).decode(
    'utf-8')
data = json.loads(output)
linked_service = data['linked_to_service'][0]['name']
info('Currently linked service is \'{}\''.format(linked_service))

if linked_service == 'muzhack-green':
    link_to = 'muzhack-blue'
else:
    assert linked_service == 'muzhack-blue'
    link_to = 'muzhack-green'

info('Redeploying service \'{}\'...'.format(link_to))
subprocess.check_call(['tutum', 'service', 'redeploy', '--sync', link_to], stdout=subprocess.PIPE)

info('Linking to service \'{}\'...'.format(link_to))
subprocess.check_call(['tutum', 'service', 'set', '--link-service', '{0}:{0}'.format(link_to),
    '--sync', 'lb.muzhack-staging'], stdout=subprocess.PIPE)
info('Successfully switched production service to {}'.format(link_to))
