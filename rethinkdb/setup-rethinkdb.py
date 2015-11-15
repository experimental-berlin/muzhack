#!/usr/bin/env python
import rethinkdb as r

conn = r.connect()
r.db_create('muzhack').run(conn)
r.db('muzhack').table_create('users').run(conn)
r.db('muzhack').table_create('projects').run(conn)
