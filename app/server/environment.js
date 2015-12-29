'use strict'
let logger = require('js-logger-aknudsen').get('environment')

module.exports = {
  getEnvParam: (key, dflt) => {
    let value = process.env[key]
    if (value == null) {
      if (dflt === undefined) {
        throw new Error(`${key} not defined in environment`)
      } else {
        return dflt
      }
    } else {
      return value
    }
  },
}
