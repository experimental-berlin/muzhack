'use strict'
let logger = require('js-logger-aknudsen').get('db')
let Boom = require('boom')
let R = require('ramda')
let Promise = require('bluebird')
let r = require('rethinkdb')

let {getEnvParam,} = require('./environment')

let closeDbConnection = (conn) => {
  conn.close()
  logger.debug('Closed RethinkDB connection')
}

let invokeCallbackWithConn = Promise.method((callback) => {
  return connectToDb()
    .then((conn) => {
      logger.debug(`Invoking callback`)
      return callback(conn)
        .finally(() => {
          closeDbConnection(conn)
        })
    })
})

let connectToDb = Promise.method((attempt) => {
  let host = getEnvParam('RETHINKDB_HOST', 'localhost')
  if (attempt == null) {
    attempt = 1
  }
  logger.debug(`Trying to connect to RethinkDB host '${host}', attempt #${attempt}`)
  return r.connect({
    host,
    authKey: getEnvParam('RETHINKDB_AUTH_KEY', null),
    db: 'muzhack',
  }).then((conn) => {
    logger.debug(`Successfully connected to RethinkDB host '${host}', attempt #${attempt}`)
    return r.dbList().run(conn)
      .then((existingDbs) => {
        if (!R.contains('muzhack', existingDbs)) {
          logger.info(`Creating database muzhack`)
          return r.dbCreate('muzhack').run(conn)
        } else {
          logger.debug(`The muzhack database already exists`)
        }
      })
      .then(() => {
        return r.tableList().run(conn)
          .then((existingTables) => {
            return Promise.all(R.reject((x) => {return x == null}, R.map((tableName) => {
              if (!R.contains(tableName, existingTables)) {
                logger.info(`Creating ${tableName} table`)
                return r.tableCreate(tableName).run(conn)
              } else {
                logger.debug(`The ${tableName} table already exists`)
                return null
              }
            }, ['projects', 'users',])))
          })
      })
      .then(() => {
        return conn
      })
  }, (error) => {
    if (attempt < 5) {
      let timeout = attempt * 0.5
      logger.debug(`Waiting ${timeout} second(s) before attempting again to connect to DB...`)
      return new Promise((resolve, reject) => {
        setTimeout(() => {
          connectToDb(attempt + 1)
            .then(resolve, reject)
        }, timeout)
      })
    } else {
      logger.warn(`Failed to connect to RethinkDB after ${attempt} attempts: '${error}':`,
        error.stack)
      throw new Error(`Failed to connect to RethinkDB after ${attempt} attempts: '${error}'`)
    }
  })
})

module.exports = {
  connectToDb,
  closeDbConnection,
  withDb: Promise.method((reply, callback) => {
    return invokeCallbackWithConn(callback)
      .then((result) => {
        logger.debug(`Replying with result:`, result)
        reply(result)
      }, (error) => {
        logger.error(`An error was caught: '${error.message}'`, error.stack)
        reply(Boom.badImplementation())
      })
  }),
  setUp: Promise.method(() => {
    let host = getEnvParam('RETHINKDB_HOST', 'localhost')
    logger.debug(`Setting up database...`)
    let indexes = ['owner',]
    return invokeCallbackWithConn((conn) => {
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
  }),
}
