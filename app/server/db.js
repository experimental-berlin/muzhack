'use strict'
let logger = require('js-logger-aknudsen').get('db')
let Boom = require('boom')
let r = require('rethinkdb')

module.exports.withDb = (reply, callback) => {
  let host = process.env.RETHINKDB_HOST || 'localhost'
  r.connect({
    host,
    authKey: process.env.RETHINKDB_AUTH_KEY,
    db: 'muzhack',
  }).then((conn) => {
    logger.debug(`Successfully connected to RethinkDB host '${host}'`)
    logger.debug(`Invoking callback`)
    callback(conn).
      then(() => {
        conn.close()
      }, (error) => {
        conn.close()
        logger.warn(`There was an error in the callback of withDb: '${error}'`, error.stack)
        reply(Boom.badImplementation())
      })
  }, (error) => {
    logger.warn(`Failed to connect to RethinkDB: '${error}':`, error.stack)
    reply(Boom.badImplementation())
  })
}
