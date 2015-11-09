'use strict'
let logger = require('js-logger-aknudsen').get('ajax')
let R = require('ramda')
let S = require('underscore.string.fp')

let path2url = (path) => {
  return `/api/${path}`
}

let ajax = (method, path, params, payload) => {
  return new Promise((resolve, reject) => {
    let url = path2url(path)
    logger.debug(`Getting ${url}`)
    let paramStr = S.join('&', R.map(([param, value,]) => {
      return `${encodeURIComponent(param)}=${encodeURIComponent(value || '')}`
    }, R.toPairs(params || {})))
    let request = new XMLHttpRequest()
    request.onreadystatechange = () => {
      if (request.readyState === XMLHttpRequest.DONE) {
        logger.debug('Received response from server:', request)
        if (request.status === 200) {
          logger.debug(`Response was successful:`, request.responseText)
          if (!S.isBlank(request.responseText)) {
            try {
              let result = JSON.parse(request.responseText)
              resolve(result)
            } catch (error) {
              logger.warn(`Received malformed JSON from server:`, request.responseText)
              reject(`Parsing JSON from server failed: ${error}`)
            }
          } else {
            resolve()
          }
        } else {
          logger.debug(`Response was not successful: ${request.status}`)
          reject(request.responseText)
        }
      }
    }

    let queryPart = !S.isBlank(paramStr) ? `?${paramStr}` : ''
    request.open(method.toUpperCase(), `${url}${queryPart}`)
    request.setRequestHeader('Content-Type', 'application/json;charset=UTF-8')
    let payloadJson = payload != null ? JSON.stringify(payload) : null
    if (payloadJson != null) {
      logger.debug(`Sending JSON`)
    } else {
      logger.debug(`Not sending JSON`)
    }
    request.send(payloadJson)
  })
}

module.exports = {
  getJson: (path, params) => {
    return ajax('get', path, params)
  },
  postJson: (path, payload) => {
    return ajax('post', path, null, payload)
  },
}
