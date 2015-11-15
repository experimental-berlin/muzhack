#!/usr/bin/env python
import rethinkdb as r
import argparse


parser = argparse.ArgumentParser(description='Set up RethinkDB locally')
parser.add_argument('auth_key', help='Specify RethinkDB authentication key')
args = parser.parse_args()

conn = r.connect()
r.db('rethinkdb').table('cluster_config').get('auth').update({'auth_key': args.auth_key,}).run(conn)
r.db_create('muzhack').run(conn)
r.db('muzhack').table_create('users').run(conn)
r.db('muzhack').table_create('projects').run(conn)
