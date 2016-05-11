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

data = {
    'production': {
        'numReplicas': 2,
        'imageVariant': '',
        'imageTag': '1.1.3',
        'imagePullPolicy': 'Always',  # TODO: Make into IfNotPresent
        'appUri': 'https://muzhack.com',
        's3Bucket': 'muzhack.com',
        'rethinkdbHost': 'rethinkdb-proxy',
        'rethinkdbClusterHost1': 'rethinkdb1',
        'rethinkdbClusterHost2': 'rethinkdb2',
    },
    'staging': {
        'numReplicas': 1,
        'imageVariant': '-test',
        'imageTag': 'latest',
        'imagePullPolicy': 'Always',
        'appUri': 'https://staging.muzhack.com',
        's3Bucket': 'staging.muzhack.com',
        'rethinkdbHost': 'rethinkdb-driver',
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
        'rethinkdb/admin-pod',
        'rethinkdb/admin-service',
        'rethinkdb/admin-service',
        'rethinkdb/rethinkdb-controller',
        'rethinkdb/driver-service',
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
