'use strict'
let logger = require('js-logger-aknudsen').get('errors')

class ValidationError extends Error {
  constructor(message) {
    super()
    this.message = message
  }
}

module.exports = {
  ValidationError,
}
