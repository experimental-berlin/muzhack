'use strict'
let logger = require('js-logger-aknudsen').get('ajaxUtils')
let S = require('underscore.string.fp')

module.exports = {
  resolveWithResponse: (json, resolve, reject) => {
    if (!S.isBlank(json)) {
      let result
      try {
        result = JSON.parse(json)
      } catch (error) {
        logger.warn(`Received malformed JSON from server:`, json)
        reject(`Parsing JSON from server failed: ${error}`)
        return
      }

      resolve(result)
    } else {
      resolve()
    }
  },
}
