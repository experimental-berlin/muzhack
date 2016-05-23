'use strict'
let logger = require('js-logger-aknudsen').get('errors')
let TypedError = require('error/typed')

let notFoundError = TypedError({
  type: 'notFound',
  message: 'Resource not found',
})

class ValidationError extends Error {
  constructor(message) {
    super()
    this.message = message
  }
}

module.exports = {
  notFoundError,
  ValidationError,
}
