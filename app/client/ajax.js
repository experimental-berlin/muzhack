'use strict'
let logger = require('js-logger-aknudsen').get('client.ajax')
let R = require('ramda')
let S = require('underscore.string.fp')

let {resolveWithResponse,} = require('../ajaxUtils')

let ajax = (method, path, params, payload) => {
  let paramStr = S.join('&', R.map(([param, value,]) => {
    return `${encodeURIComponent(param)}=${encodeURIComponent(value || '')}`
  }, R.toPairs(params || {})))
  let queryPart = !S.isBlank(paramStr) ? `?${paramStr}` : ''
  let absPath = `/api/${path}${queryPart}`
  let payloadJson = payload != null ? JSON.stringify(payload) : null

  let clientAjax = (resolve, reject) => {
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

  return new Promise((resolve, reject) => {
    if (__IS_BROWSER__) {
      clientAjax(resolve, reject)
    } else {
      let serverAjax = require('../server/ajax')
      serverAjax(resolve, reject)
    }
  })
}

module.exports = {
  getJson: (path, params) => {
    return ajax('get', path, params)
  },
  postJson: (path, payload) => {
    return ajax('post', path, null, payload)
  },
  putJson: (path, payload) => {
    return ajax('put', path, null, payload)
  },
  delete: (path) => {
    return ajax('delete', path)
  },
}
