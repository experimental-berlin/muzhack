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
      'Content-type': 'application/json',
    },
  }, (error, response, body) => {
    if (error == null && response.statusCode === 200) {
      resolveWithResponse(body, resolve, reject)
    } else {
      let reason = error == null ? body : error
      logger.debug(`There was an error in handling the request: '${reason}'`)
      reject(reason)
    }
  })
}
