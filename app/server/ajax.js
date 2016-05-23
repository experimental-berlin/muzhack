'use strict'
let request = require('request')
let logger = require('js-logger-aknudsen').get('server.ajax')
let R = require('ramda')

let {resolveWithResponse,} = require('../ajaxUtils')
let {getEnvParam,} = require('./environment')
let {notFoundError,} = require('../errors')

module.exports = (uri, method, payloadJson, options, resolve, reject) => {
  if (uri.startsWith('/')) {
    uri = `${getEnvParam('MUZHACK_URI')}${uri}`
  }

  let extendedHeaders = R.merge({
    'User-Agent': 'request',
    'Content-Type': 'application/json;charset=UTF-8',
    'Accept': 'application/json',
  }, options.headers || {})
  logger.debug(`Making ${method} request to '${uri}', JSON:`, payloadJson)
  request({
    method,
    uri,
    body: payloadJson,
    headers: extendedHeaders,
  }, (error, response, body) => {
    if (error == null && response.statusCode >= 200 && response.statusCode < 300) {
      resolveWithResponse(body, resolve, reject)
    } else {
      logger.debug(`Ajax request failed, status code: ${response.statusCode}`)
      if (response.statusCode === 404) {
        reject(notFoundError())
      } else {
        let reason = error == null ? body : error
        if (typeof reason === 'string') {
          try {
            logger.debug(`Trying to parse request body as JSON`)
            reason = JSON.parse(reason)
            logger.debug(`Successfully parsed request body as JSON`)
          } catch (e) {
            logger.debug(`Couldn't parse body as JSON`)
          }
        }
        logger.debug(`There was an error in handling the request:`, reason)
        reject(reason)
      }
    }
  })
}
