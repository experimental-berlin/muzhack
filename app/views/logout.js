'use strict'
let logger = require('js-logger-aknudsen').get('logout')

let ajax = require('../ajax')
let router = require('../router')

module.exports.render = (cursor) => {
  logger.debug('Logging out...')
  ajax.getJson('logout')
    .then(() => {
      logger.info(`Successfully logged out`)
      cursor.set('loggedInUser', null)
      router.goTo('/')
    }, () => {
      logger.warn(`Logging out failed`)
    })
}
