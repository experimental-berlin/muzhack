'use strict'
let logger = require('js-logger-aknudsen').get('environment')

module.exports = {
  getEnvParam: (key, dflt) => {
    let value = process.env[key]
    if (value == null) {
      if (dflt === undefined) {
        logger.error(`${key} not defined in environment`)
        reply(Boom.badImplementation())
      } else {
        return dflt
      }
    } else {
      return value
    }
  },
}
