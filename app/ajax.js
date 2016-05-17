'use strict'
let logger = require('js-logger-aknudsen').get('ajax')
let R = require('ramda')
let S = require('underscore.string.fp')

let ajax = (method, uri, params, payload, options={}) => {
  let paramStr = S.join('&', R.map(([param, value,]) => {
    return `${encodeURIComponent(param)}=${encodeURIComponent(value || '')}`
  }, R.toPairs(params || {})))
  let queryPart = !S.isBlank(paramStr) ? `?${paramStr}` : ''
  let absPath = `${uri}${queryPart}`
  let payloadJson = payload != null ? JSON.stringify(payload) : null

  return new Promise((resolve, reject) => {
    if (__IS_BROWSER__) {
      let clientAjax = require('./client/ajax')
      clientAjax(absPath, method, payloadJson, options, resolve, reject)
    } else {
      let serverAjax = require('./server/ajax')
      serverAjax(absPath, method, payloadJson, options, resolve, reject)
    }
  })
}

module.exports = {
  getJson: (path, params, options) => {
    return ajax('get', path, params, null, options)
  },
  postJson: (path, payload, options) => {
    return ajax('post', path, null, payload, options)
  },
  putJson: (path, payload, options) => {
    return ajax('put', path, null, payload, options)
  },
  delete: (path, options) => {
    return ajax('delete', path, null, null, options)
  },
}
