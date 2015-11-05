'use strict'
let moment = require('moment')

module.exports.displayDateTextual = (date) => {
  return moment(date).format('MMMM Do YYYY')
}
