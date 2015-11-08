'use strict'
let S = require('underscore.string.fp')

module.exports = {
  trimWhitespace: (str) => {
    return S.trim(null, str)
  },
  escapeHtml: (str) => {
    let div = document.createElement('div')
    div.appendChild(document.createTextNode(str))
    return div.innerHTML
  },
}
