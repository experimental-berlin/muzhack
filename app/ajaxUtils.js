'use strict'
let logger = require('@arve.knudsen/js-logger').get('ajaxUtils')
let S = require('underscore.string.fp')

module.exports = {
  resolveWithResponse: (json, response, resolve, reject) => {
    if (!S.isBlank(json)) {
      let result
      try {
        result = JSON.parse(json)
      } catch (error) {
        logger.warn(`Received malformed JSON from server:`, json)
        reject(`Parsing JSON from server failed: ${error}`)
        return
      }

      resolve([result, response,])
    } else {
      resolve([undefined, response,])
    }
  },
}
