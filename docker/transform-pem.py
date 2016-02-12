#!/usr/bin/env python3
"""Script to transform letsencrypt certificate files into string that can be
inserted into environment variable for DockerCloud to pick up.

Put your private key in certs/privkey.pem and your certificate in
certs/fullchain.pem, then run this script in order to obtain a certificate
string compatible with HAProxy and ready for inserting into an environment
variable.
"""
import re

with open('certs/privkey.pem', 'rb') as f:
    private_key = f.read().replace('\n', '\\n')

with open('certs/fullchain.pem', 'rb') as f:
    certificate = f.read().replace('\n', '\\n')

print("""{}{}""".format(private_key, certificate))
