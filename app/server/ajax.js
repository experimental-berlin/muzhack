'use strict'
let request = require('request')
let logger = require('js-logger-aknudsen').get('server.ajax')

let {resolveWithResponse,} = require('../ajaxUtils')

module.exports = {
  serverAjax: (absPath, method, payloadJson, resolve, reject) => {
    let uri = `${process.env.MUZHACK_URI}${absPath}`
    logger.debug(`Making ${method} request to '${uri}'`)
    request({
      method,
      uri,
      json: payloadJson,
    }, (error, response, body) => {
      if (error == null) {
        resolveWithResponse(body, resolve, reject)
      } else {
        reject(error)
      }
    })
  },
}
