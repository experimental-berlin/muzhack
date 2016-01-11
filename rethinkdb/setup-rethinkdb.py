#!/usr/bin/env python3
import rethinkdb as r
import argparse


parser = argparse.ArgumentParser(description='Set up RethinkDB')
parser.add_argument('-H', '--host', default='localhost', help='Specify host')
args = parser.parse_args()

conn = r.connect(host=args.host)
r.db_create('muzhack').run(conn)
r.db('muzhack').table_create('users').run(conn)
r.db('muzhack').table_create('projects').run(conn)
r.db('muzhack').table_create('resetPasswordTokens').run(conn)
