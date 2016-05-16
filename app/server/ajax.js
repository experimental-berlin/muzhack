'use strict'
let request = require('request')
let logger = require('js-logger-aknudsen').get('server.ajax')
let R = require('ramda')

let {resolveWithResponse,} = require('../ajaxUtils')
let {getEnvParam,} = require('./environment')

module.exports = (uri, method, payloadJson, resolve, reject) => {
  if (uri.startsWith('/')) {
    uri = `${getEnvParam('MUZHACK_URI')}${uri}`
  }

  logger.debug(`Making ${method} request to '${uri}', JSON:`, payloadJson)
  request({
    method,
    uri,
    body: payloadJson,
    headers: {
      'User-Agent': 'request',
      'Content-type': 'application/json',
      'Accept': 'application/json',
    },
  }, (error, response, body) => {
    if (error == null && response.statusCode === 200) {
      resolveWithResponse(body, resolve, reject)
    } else {
      logger.debug(`Ajax request failed`)
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
  })
}
