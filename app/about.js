'use strict'
let d = require('react').DOM
require('./about.styl')
require('./bitcoinate.styl')

module.exports = {
  render: (cursor) => {
    return d.div({className: 'pure-g',}, d.div({className: 'pure-u-1',},
      d.div({id: 'about-pad', className: 'airy-padding-sides',},
        d.h1({}, 'About MuzHack'), d.p({}, 'MuzHack is a joint effort between Arve ' +
        'Knudsen and Notam to produce an online hub for music technology projects. The goal is ' +
        'that this application should contain descriptions of the outcomes of such projects, and ' +
        'generally facilitate their re-production.'))))
  },
}
