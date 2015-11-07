'use strict'
let component = require('omniscient')
let h = require('react-hyperscript')

module.exports = component('Loading', () => {
  return h('p', 'Loading...')
})
