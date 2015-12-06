'use strict'
module.exports = {
  getEnvParam: (key) => {
    let value = process.env[key]
    if (value == null) {
      logger.error(`${key} not defined in environment`)
      reply(Boom.badImplementation())
    } else {
      return value
    }
  },
}
