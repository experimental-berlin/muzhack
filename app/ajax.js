'use strict'
let logger = require('@arve.knudsen/js-logger').get('ajax')
let R = require('ramda')
let S = require('underscore.string.fp')
let Promise = require('bluebird')

let ajax = Promise.method((method, uri, params, payload, options={}) => {
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
    .then(([result, response,]) => {
      if (options.includeResponse) {
        return [result, response,]
      } else {
        return result
      }
    }, (error) => {
      if (typeof error === 'string') {
        throw new Error(error)
      } else {
        throw error
      }
    })
})

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
