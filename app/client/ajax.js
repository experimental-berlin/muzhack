'use strict'
let logger = require('js-logger-aknudsen').get('client.ajax')
let S = require('underscore.string.fp')

let {resolveWithResponse,} = require('../ajaxUtils')

module.exports = (absPath, method, payloadJson, resolve, reject) => {
  logger.debug(`Getting ${absPath}`)
  let request = new XMLHttpRequest()
  request.onreadystatechange = () => {
    if (request.readyState === XMLHttpRequest.DONE) {
      logger.debug('Received response from server:', request)
      if (request.status === 200) {
        logger.debug(`Response was successful:`, request.responseText)
        resolveWithResponse(request.responseText, resolve, reject)
      } else {
        logger.debug(`Response was not successful: ${request.status}`)
        let result = !S.isBlank(request.responseText) ? JSON.parse(request.responseText) : ''
        reject(result)
      }
    }
  }

  request.open(method.toUpperCase(), absPath)
  request.setRequestHeader('Content-Type', 'application/json;charset=UTF-8')
  if (payloadJson != null) {
    logger.debug(`Sending JSON`)
  } else {
    logger.debug(`Not sending JSON`)
  }
  request.send(payloadJson)
}
