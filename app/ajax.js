'use strict'
let logger = require('js-logger').get('ajax')
let R = require('ramda')
let S = require('underscore.string.fp')

let path2url = (path) => {
  return `/api/${path}`
}

module.exports = {
  getJson: (path, params) => {
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
            logger.debug(`Response was successful`)
            resolve(JSON.parse(request.responseText))
          } else {
            logger.debug(`Response was not successful: ${request.status}`)
            reject(request.responseText)
          }
        }
      }

      let queryPart = !S.isBlank(paramStr) ? `?${paramStr}` : ''
      request.open('GET', `${url}${queryPart}`)
      request.send()
    })
  },
}
