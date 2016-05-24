'use strict'
let Promise = require('bluebird')

module.exports = {
  requestHandler: (func) => {
    return (request, reply) => {
      Promise.method(func)(request, reply)
        .catch((error) => {
          logger.error(`An uncaught exception occurred:`, error.stack)
          reply(Boom.badImplementation())
        })
    }
  },
}
