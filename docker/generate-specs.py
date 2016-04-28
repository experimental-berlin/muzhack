#!/usr/bin/env python3
"""Generate GKE spec files."""
import os.path
import jinja2

data = {
    'production': {
        'imagePullPolicy': 'IfNotPresent',
        'appUri': 'https://muzhack.com',
        's3Bucket': 'muzhack.com',
    },
    'staging': {
        'imagePullPolicy': 'Always',
        'appUri': 'https://staging.muzhack.com',
        's3Bucket': 'staging.muzhack.com',
    },
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
    ]:
        with open(os.path.join('docker/templates', fname + '.yaml'), 'rt') \
                as f:
            content = f.read()

        template = jinja2.Template(content)
        output = template.render(**data[environment])

        if not os.path.exists(os.path.join(dpath, os.path.dirname(fname))):
            os.makedirs(os.path.join(dpath, os.path.dirname(fname)))
        with open(os.path.join(dpath, fname + '.yaml'), 'wt') as f:
            f.write(output + '\n')
