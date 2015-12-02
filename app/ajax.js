'use strict'
let logger = require('js-logger-aknudsen').get('ajax')
let R = require('ramda')
let S = require('underscore.string.fp')

let ajax = (method, path, params, payload) => {
  let paramStr = S.join('&', R.map(([param, value,]) => {
    return `${encodeURIComponent(param)}=${encodeURIComponent(value || '')}`
  }, R.toPairs(params || {})))
  let queryPart = !S.isBlank(paramStr) ? `?${paramStr}` : ''
  let absPath = `/api/${path}${queryPart}`
  let payloadJson = payload != null ? JSON.stringify(payload) : null

  return new Promise((resolve, reject) => {
    if (__IS_BROWSER__) {
      let clientAjax = require('./client/ajax')
      clientAjax(absPath, method, payloadJson, resolve, reject)
    } else {
      let serverAjax = require('./server/ajax')
      serverAjax(absPath, method, payloadJson, resolve, reject)
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
