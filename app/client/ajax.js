'use strict'
let logger = require('js-logger-aknudsen').get('client.ajax')
let S = require('underscore.string.fp')
let R = require('ramda')
let {notFoundError,} = require('../errors')

let {resolveWithResponse,} = require('../ajaxUtils')

module.exports = (absPath, method, payloadJson, options, resolve, reject) => {
  logger.debug(`Getting ${absPath}`)
  let request = new XMLHttpRequest()
  request.onreadystatechange = () => {
    if (request.readyState === XMLHttpRequest.DONE) {
      logger.debug('Received response from server:', request)
      if (request.status >= 200 && request.status < 300) {
        let headersStr = request.getAllResponseHeaders()
        let headers = R.fromPairs(
          R.map((headerStr) => {
            let matches = R.match(/(.+): (.+)/, headerStr)
            return [matches[1], matches[2],]
          }, S.wordsDelim('\n', headersStr))
        )
        let response = {
          headers,
        }
        resolveWithResponse(request.responseText, response, resolve, reject)
      } else {
        logger.debug(`Response was not successful: ${request.status}`)
        if (request.status === 404) {
          reject(notFoundError())
        } else {
          let result = new Error(!S.isBlank(request.responseText) ?
            JSON.parse(request.responseText).message : '')
          logger.debug(`Rejecting with:`, result)
          reject(result)
        }
      }
    }
  }

  request.open(method.toUpperCase(), absPath)
  let extendedHeaders = R.merge({
    'Content-Type': 'application/json;charset=UTF-8',
  }, options.headers || {})
  R.forEach(([key, value,]) => {
    request.setRequestHeader(key, value)
  }, R.toPairs(extendedHeaders))
  if (payloadJson != null) {
    logger.debug(`Sending JSON`)
  } else {
    logger.debug(`Not sending JSON`)
  }
  request.send(payloadJson)
}
