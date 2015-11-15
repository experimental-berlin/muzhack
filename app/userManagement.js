'use strict'
let R = require('ramda')

module.exports = {
  getLoggedInUser: (cursor) => {
    let user = cursor.get('loggedInUser') || {}
    return !R.isEmpty(user) ? user : null
  }
}
