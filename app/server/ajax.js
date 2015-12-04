'use strict'
let request = require('request')
let logger = require('js-logger-aknudsen').get('server.ajax')

module.exports = (absPath, method, payloadJson, resolve, reject) => {
  let uri = `${process.env.MUZHACK_URI}${absPath}`
  logger.debug(`Making ${method} request to '${uri}'`)
  request({
    method,
    uri,
    json: payloadJson,
  }, (error, response, body) => {
    if (error == null && response.statusCode === 200) {
      resolve(body)
    } else {
      let reason
      if (error == null) {
        reason = body.message
      } else {
        reason = error
      }
      logger.debug(`There was an error in handling the request: '${reason}'`)
      reject(reason)
    }
  })
}
