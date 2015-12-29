'use strict'
let component = require('omniscient')
let h = require('react-hyperscript')
let S = require('underscore.string.fp')
let R = require('ramda')

module.exports = component('TransparentButton', function ({classes, onClick,}) {
  let classesStr = S.join('.', R.concat(classes, ['transparent-button',]))
  return h(`button.${classesStr}`, {
    onClick,
  }, this.props.children)
})
