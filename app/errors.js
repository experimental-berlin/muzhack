'use strict'
let logger = require('@arve.knudsen/js-logger').get('errors')
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

let badRequest = (message) => {
  return TypedError({
   type: 'badRequest',
   message,
   statusCode: 400,
 })
}

module.exports = {
  notFoundError,
  validationError,
  alreadyExistsError,
  badRequest,
}
