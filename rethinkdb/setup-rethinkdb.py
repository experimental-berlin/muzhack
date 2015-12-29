#!/usr/bin/env python
import rethinkdb as r
import argparse


parser = argparse.ArgumentParser(description='Set up RethinkDB locally')

args = parser.parse_args()

conn = r.connect()

r.db_create('muzhack').run(conn)
r.db('muzhack').table_create('users').run(conn)
r.db('muzhack').table_create('projects').run(conn)
r.db('muzhack').table_create('resetPasswordTokens').run(conn)
