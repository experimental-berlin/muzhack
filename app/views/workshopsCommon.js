'use strict'
let R = require('ramda')
let moment = require('moment')

let partitionWorkshops = (user) => {
  let upcomingWorkshops = R.filter((workshop) => {
    return moment(workshop.startTime).diff(moment().utc()) >= 0
  }, user.workshops)
  let pastWorkshops = R.difference(user.workshops, upcomingWorkshops)
  return [upcomingWorkshops, pastWorkshops,]
}

module.exports = {
  partitionWorkshops,
}
