#!/usr/bin/env python3
"""Generate GKE spec files."""
import os.path
import jinja2
import json
import base64


def _render_template(fname, environment, context):
    with open(os.path.join('docker/templates', fname + '.yaml'), 'rt') \
            as f:
        content = f.read()

    jinja_env = jinja2.Environment(
        loader=jinja2.FileSystemLoader(searchpath='docker/templates'),
        undefined=jinja2.StrictUndefined
    )
    template = jinja_env.get_template(fname + '.yaml')
    merged_context = {**context[environment], **{'environment': environment, }}
    output = template.render(**merged_context)

    if not os.path.exists(os.path.join(dpath, os.path.dirname(fname))):
        os.makedirs(os.path.join(dpath, os.path.dirname(fname)))
    with open(os.path.join(dpath, fname + '.yaml'), 'wt') as f:
        f.write(output + '\n')

fb_app_id = '274051199640220'
data = {
    'production': {
        'appEnvironment': 'production',
        'numReplicas': 2,
        'imageVariant': '',
        'imageTag': 'v1.1.56',
        'imageProcessorImageTag': 'v1.1.16',
        'imagePullPolicy': 'IfNotPresent',
        'appUri': 'https://muzhack.com',
        's3Bucket': 'muzhack.com',
        'fbAppId': fb_app_id,
        'rethinkdbHost': 'rethinkdb-proxy',
        'rethinkdbClusterHost1': 'rethinkdb1',
        'rethinkdbClusterHost2': 'rethinkdb2',
        'discourseUrl': 'http://forums.muzhack.com',
        'gcloudBucket': 'muzhack.com',
        'gcloudProjectId': 'muzhack-1288',
        'gcloudClientEmail': 'muzhack@muzhack-1288.iam.gserviceaccount.com'
    },
    'staging': {
        'appEnvironment': 'staging',
        'numReplicas': 1,
        'imageVariant': '-test',
        'imageTag': 'latest',
        'imageProcessorImageTag': 'latest',
        'imagePullPolicy': 'Always',
        'appUri': 'https://staging.muzhack.com',
        's3Bucket': 'staging.muzhack.com',
        'fbAppId': fb_app_id,
        'rethinkdbHost': 'rethinkdb-driver',
        'discourseUrl': 'http://forums.muzhack.com',
        'gcloudBucket': 'staging.muzhack.com',
        'gcloudProjectId': 'muzhack-1288',
        'gcloudClientEmail': 'muzhack@muzhack-1288.iam.gserviceaccount.com'
    },
}

with open(os.path.join('docker', 'secrets.json'), 'rt') as f:
    secrets_raw = json.load(f)

secrets = {}
for environment, values_raw in secrets_raw.items():
    secrets[environment] = {
        k: base64.b64encode(bytes(v, 'utf-8')).decode() for
        k, v in values_raw.items()
    }

for environment in ['staging', 'production', ]:
    dpath = os.path.join('docker', environment)
    if not os.path.exists(dpath):
        os.makedirs(dpath)

    for fname in [
        'l7-ingress',
        'web-controller',
        'web-service',
        'rethinkdb/staging',
    ]:
        _render_template(fname, environment, data)

    for fname in [
        'env-secret',
        'quay-io-secret',
        'web-secret',
    ]:
        _render_template(fname, environment, secrets)

for fname in [
    'rethinkdb/proxy-deployment',
    'rethinkdb/proxy-service',
    'rethinkdb/backup',
]:
    _render_template(fname, 'production', data)

_render_template('backup-secret', 'production', secrets)
