'use strict'
let h = require('react-hyperscript')
let component = require('omniscient')
let logger = require('js-logger').get('focusingInput')
let ReactDOM = require('react-dom')
let S = require('underscore.string.fp')

module.exports = component({
  componentDidMount: function () {
    let node = ReactDOM.findDOMNode(this)
    logger.debug('Giving focus to input node:', node)
    node.select()
  },
}, ({id, value, placeholder, ref, classes, type, onChange, onEnter,}) => {
  return h('input', {
    id,
    className: S.join(' ', classes || []),
    type,
    placeholder,
    value,
    ref,
    onChange,
    onKeyUp: (event) => {
      if (event.keyCode === 13 && onEnter != null) {
        logger.debug('Enter pressed')
        onEnter()
      }
    },
  })
})
