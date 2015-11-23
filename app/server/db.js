'use strict'
let logger = require('js-logger-aknudsen').get('db')
let Boom = require('boom')
let R = require('ramda')
let r = require('rethinkdb')

let connectToDb = (reply, host, callback, attempt) => {
  logger.debug(`Trying to connect to RethinkDB host '${host}', attempt #${attempt}`)
  r.connect({
    host,
    authKey: process.env.RETHINKDB_AUTH_KEY,
    db: 'muzhack',
  }).then((conn) => {
    logger.debug(`Successfully connected to RethinkDB host '${host}', attempt ${attempt}`)
    logger.debug(`Invoking callback`)
    callback(conn)
      .then((result) => {
        conn.close()
        logger.debug(`Replying with result:`, result)
        reply(result)
      }, (error) => {
        logger.warn(`There was an error in the callback of withDb: '${error}'`, error.stack)
        conn.close()
        reply(Boom.badImplementation())
      })
  }, (error) => {
    if (attempt < 5) {
      let timeout = attempt * 0.5
      logger.debug(`Waiting ${timeout} second(s) before attempting again to connect to DB...`)
      setTimeout(R.partial(connectToDb, [reply, host, callback, attempt + 1,]), timeout)
    } else {
      logger.warn(`Failed to connect to RethinkDB after ${attempt} attempts: '${error}':`,
        error.stack)
      reply(Boom.badImplementation())
    }
  })
}

module.exports.withDb = (reply, callback) => {
  let host = process.env.RETHINKDB_HOST || 'localhost'
  return connectToDb(reply, host, callback, 1)
}
