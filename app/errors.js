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
    statusCode: 400,
  })()
}

let alreadyExistsError = TypedError({
  type: 'alreadyExists',
  message: 'Resource already exists',
  statusCode: 400,
})

module.exports = {
  notFoundError,
  validationError,
  alreadyExistsError,
}
