'use strict'
let logger = require('js-logger-aknudsen').get('logout')
let h = require('react-hyperscript')

let ajax = require('../client/ajax')
let router = require('../router')

module.exports = {
  redirectIfLoggedOut: true,
  render: () => {
    return h('p', 'Logging out...')
  },
  loadData: (cursor) => {
    if (cursor.get('loggedInUser') == null) {
      logger.debug(`User is already logged out - redirecting...:`, cursor.toJS())
      if (__IS_BROWSER__) {
        router.goTo('/')
      }
      return
    } else {
      logger.debug('Logging out...')
      return ajax.getJson('logout')
        .then(() => {
          logger.info(`Successfully logged out`)
          if (__IS_BROWSER__) {
            router.goTo('/')
          }
          return {
            loggedInUser: null,
          }
        }, () => {
          logger.warn(`Logging out failed`)
        })
    }
  },
}
