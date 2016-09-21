'use strict'
let logger = require('@arve.knudsen/js-logger').get('logout')
let h = require('react-hyperscript')

let ajax = require('../ajax')

module.exports = {
  shouldRenderServerSide: false,
  redirectIfLoggedOut: true,
  render: () => {
    return h('p', 'Logging out...')
  },
  loadData: (cursor) => {
    if (cursor.get('loggedInUser') == null) {
      logger.debug(`User is already logged out:`, cursor.toJS())
      return
    } else {
      logger.debug('Logging out...')
      return ajax.getJson('/api/logout')
        .then(() => {
          logger.info(`Successfully logged out`)
          return {
            loggedInUser: null,
          }
        }, () => {
          logger.warn(`Logging out failed`)
        })
    }
  },
}
