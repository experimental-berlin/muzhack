'use strict'
let R = require('ramda')

module.exports = {
  getLoggedInUser: (cursor) => {
    let user = cursor.cursor('loggedInUser').toJS()
    return !R.isEmpty(user) ? user : null
  }
}
