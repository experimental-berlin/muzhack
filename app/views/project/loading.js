'use strict'
let component = require('omniscient')
let h = require('react-hyperscript')

module.exports =  component('Loading', (cursor) => {
  return h('div', [
    'Loading...',
    h('br'),
    cursor.get('isWaiting'),
  ,])
})
