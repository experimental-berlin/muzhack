'use strict'
let logger = require('js-logger-aknudsen').get('errors')
let TypedError = require('error/typed')

let notFoundError = TypedError({
  type: 'notFound',
  message: 'Resource not found',
})

let validationError = (message) => {
  return TypedError({
    type: 'validation',
    message,
  })()
}

module.exports = {
  notFoundError,
  validationError,
}
