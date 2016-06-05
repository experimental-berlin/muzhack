'use strict'
let logger = require('js-logger-aknudsen').get('server.api.apiUtils')
let r = require('rethinkdb')

let getUserWithConn = (username, conn) => {
  if (username == null) {
    throw new Error(`username is null`)
  }
  logger.debug(`Getting user '${username}'...`)
  return r.table('users')
    .get(username)
    .do((user) => {
      return r.branch(
        user.eq(null),
        null,
        user.merge({
          'projects': r.table('projects').getAll(username, {index: 'owner',})
            .coerceTo('array'),
        })
      )
    })
    .run(conn)
}
