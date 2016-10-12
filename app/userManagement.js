'use strict'
let R = require('ramda')
let logger = require('@arve.knudsen/js-logger').get('userManagement')

module.exports = {
  getLoggedInUser: (cursor) => {
    let user = cursor.cursor('loggedInUser').toJS()
    return !R.isEmpty(user) ? user : null
  },
}
