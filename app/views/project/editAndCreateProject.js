'use strict'
let logger = require('js-logger-aknudsen').get('editAndCreateProject')
let immstruct = require('immstruct')
let Promise = require('bluebird')
let R = require('ramda')
let h = require('react-hyperscript')

let inputChangeHandler = (fieldName, cursorName, handler) => {
  return (event) => {
    let cursor = immstruct.instance('state').reference(cursorName).cursor()
    cursor = cursor.set('isReady', false)
    Promise.method(handler)(event, cursor)
      .then((validationError) => {
        logger.debug(
          `Input change handler '${fieldName}' completed, validation error: ${validationError}`)
        cursor = immstruct.instance('state').reference(cursorName).cursor()
        cursor = cursor.update((current) => {
          if (validationError != null) {
            current = current.setIn(['errors', fieldName,], validationError)
          } else {
            current = current.deleteIn(['errors', fieldName,])
          }

          let currentErrors = current.get('errors').toJS()
          if (R.isEmpty(currentErrors)) {
            logger.debug(`No input errors detected, enabling saving`, currentErrors)
            current = current.set('isReady', true)
          } else {
            logger.debug(`Input errors detected, not enabling saving`, currentErrors)
            current = current.set('isReady', false)
          }
          return current
        })
      })
  }
}

let renderFieldError = (errors, fieldName) => {
  let errorText = errors[fieldName]
  return errorText != null ? h(`#${fieldName}-error.field-error`, `* ${errorText}`) : null
}

module.exports = {
  inputChangeHandler,
  renderFieldError,
}
