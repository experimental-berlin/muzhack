'use strict'
let h = require('react-hyperscript')
let component = require('omniscient')
let logger = require('@arve.knudsen/js-logger').get('focusingInput')
let ReactDOM = require('react-dom')
let S = require('underscore.string.fp')

module.exports = component('FocusingInput', {
  componentDidMount: function () {
    let node = ReactDOM.findDOMNode(this)
    logger.debug('Giving focus to input node:', node)
    node.select()
  },
}, ({id, value, refName, placeholder, classes, type, name, required, onChange, onEnter,}) => {
  return h('input', {
    id,
    className: S.join(' ', classes || []),
    type: type || 'text',
    name,
    placeholder,
    required,
    value,
    ref: refName,
    onChange,
    onKeyUp: (event) => {
      if (event.keyCode === 13 && onEnter != null) {
        logger.debug('Enter pressed')
        onEnter()
      }
    },
  })
})
