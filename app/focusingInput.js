'use strict'
let h = require('react-hyperscript')
let component = require('omniscient')
let logger = require('js-logger').get('focusingInput')
let ReactDOM = require('react-dom')

module.exports = component({
  componentDidMount: function () {
    let node = ReactDOM.findDOMNode(this)
    logger.debug('Giving input focus')
    node.select()
  },
}, ({id, value, placeholder, ref, onChange,}) => {
  return h('input', {
    id,
    placeholder,
    value,
    ref: 'Yoo',
    onChange,
  })
})
