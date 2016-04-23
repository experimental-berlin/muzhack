'use strict'
let logger = require('js-logger-aknudsen').get('db')
let Boom = require('boom')
let R = require('ramda')
let r = require('rethinkdb')

let {getEnvParam,} = require('./environment')

let closeConn = (conn) => {
  conn.close()
  logger.debug('Closed RethinkDB connection')
}

let connectToDb = (host, callback, attempt) => {
  if (attempt == null) {
    attempt = 1
  }
  logger.debug(`Trying to connect to RethinkDB host '${host}', attempt #${attempt}`)
  return r.connect({
    host,
    authKey: getEnvParam('RETHINKDB_AUTH_KEY', null),
    db: 'muzhack',
  }).then((conn) => {
    let invokeCallback = () => {
      logger.debug(`Invoking callback`)
      return callback(conn)
        .then((result) => {
          closeConn(conn)
          return result
        }, (error) => {
          closeConn(conn)
          logger.warn(`There was an error in the callback of withDb: '${error}'`, error.stack)
          throw new Error(`There was an error in the callback of withDb`)
        })
    }

    logger.debug(`Successfully connected to RethinkDB host '${host}', attempt #${attempt}`)
    try {
      return r.dbList().run(conn)
        .then((existingDbs) => {
          let promise
          if (!R.contains('muzhack', existingDbs)) {
            logger.info(`Creating MuzHack database`)
            return r.dbCreate('muzhack').run(conn)
              .then(invokeCallback)
          } else {
            return invokeCallback()
          }
        })
    } catch (error) {
      closeConn(conn)
      logger.error(`There was an unhandled exception in the callback of withDb: '${error}'`,
        error.stack)
      throw new Error(`There was an unhandled exception in the callback of withDb`)
    }
  }, (error) => {
    if (attempt < 5) {
      let timeout = attempt * 0.5
      logger.debug(`Waiting ${timeout} second(s) before attempting again to connect to DB...`)
      return new Promise((resolve, reject) => {
        setTimeout(() => {
          connectToDb(host, callback, attempt + 1)
            .then(resolve, reject)
        }, timeout)
      })
    } else {
      logger.warn(`Failed to connect to RethinkDB after ${attempt} attempts: '${error}':`,
        error.stack)
      throw new Error(`Failed to connect to RethinkDB after ${attempt} attempts: '${error}'`)
    }
  })
}

module.exports = {
  withDb: (reply, callback) => {
    let host = getEnvParam('RETHINKDB_HOST', 'localhost')
    return connectToDb(host, callback)
      .then((result) => {
        logger.debug(`Replying with result:`, result)
        reply(result)
      }, (error) => {
        logger.warn(`An error was caught: '${error.message}'`)
        reply(Boom.badImplementation())
      })
  },
  setUp: () => {
    let host = getEnvParam('RETHINKDB_HOST', 'localhost')
    logger.debug(`Setting up database...`)
    let indexes = ['owner',]
    return connectToDb(host, (conn) => {
      return r.table('projects').indexList()
        .run(conn)
        .then((existingIndexes) => {
          let indexPromises = R.map((index) => {
            logger.debug(`Creating index '${index}'...`)
            return r.table('projects')
              .indexCreate(index)
              .run(conn)
          }, R.difference(indexes, existingIndexes))
          return Promise.all(indexPromises)
            .then(() => {
              return r.table('projects')
                .indexWait()
                .run(conn)
            })
      })
    })
  },
}
