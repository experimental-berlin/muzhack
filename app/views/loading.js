'use strict'
let component = require('omniscient')
let h = require('react-hyperscript')

module.exports = component('Loading', () => {
  return h('.spinner', [
    h('.rect1'),
    h('.rect2'),
    h('.rect3'),
    h('.rect4'),
    h('.rect5'),
  ])
})
