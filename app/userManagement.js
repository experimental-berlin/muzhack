'use strict'
let R = require('ramda')
let logger = require('js-logger-aknudsen').get('userManagement')

module.exports = {
  getLoggedInUser: (cursor) => {
    let user = cursor.cursor('loggedInUser').toJS()
    return !R.isEmpty(user) ? user : null
  },
}
