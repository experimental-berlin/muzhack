'use strict'
let logger = require('@arve.knudsen/js-logger').get('server.requestHandler')
let Promise = require('bluebird')
let Boom = require('boom')

module.exports = {
  requestHandler: (func) => {
    return (request, reply) => {
      Promise.method(func)(request, reply)
        .catch((error) => {
          let statusCode = error.statusCode != null ? error.statusCode : 500
          if (statusCode < 500 || statusCode >= 600) {
            logger.debug(`Caught exception meant for client:`, error)
            if (error.statusCode >= 400 && error.statusCode < 500) {
              reply(Boom.badRequest(error.message, error.data))
            } else {
              logger.debug(`Unhandled exception status code ${error.statusCode}`)
              reply(boom.badImplementation())
            }
          } else {
            logger.error(`An uncaught exception occurred:`, error.stack)
            reply(Boom.badImplementation())
          }
        })
    }
  },
}
