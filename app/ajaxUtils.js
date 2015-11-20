'use strict'
let logger = require('js-logger-aknudsen').get('ajaxUtils')
let S = require('underscore.string.fp')

module.exports = {
  resolveWithResponse: (json, resolve, reject) => {
    if (!S.isBlank(json)) {
      try {
        let result = JSON.parse(json)
        resolve(result)
      } catch (error) {
        logger.warn(`Received malformed JSON from server:`, request.responseText)
        reject(`Parsing JSON from server failed: ${error}`)
      }
    } else {
      resolve()
    }
  },
}
