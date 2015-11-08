'use strict'
let logger = require('js-logger').get('errors')

class ValidationError  extends Error {
  constructor(message) {
    super()
    this.message = message
  }
}

module.exports = {
  ValidationError,
  logError: (logger, message, ...args) => {
    logger.error(message, ...args)
    // Meteor.call("logError", message)
  },
}
