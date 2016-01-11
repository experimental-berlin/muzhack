#!/usr/bin/env python3
import rethinkdb as r
import argparse


parser = argparse.ArgumentParser(description='Set up RethinkDB')
parser.add_argument('-H', '--host', default='localhost', help='Specify host')
parser.add_argument('-a', '--auth-key', help='Specify authentication key')
args = parser.parse_args()

kwargs = {'host': args.host}
if args.auth_key:
    kwargs['auth_key'] = args.auth_key
conn = r.connect(**kwargs)
r.db_create('muzhack').run(conn)
r.db('muzhack').table_create('users').run(conn)
r.db('muzhack').table_create('projects').run(conn)
r.db('muzhack').table_create('resetPasswordTokens').run(conn)
