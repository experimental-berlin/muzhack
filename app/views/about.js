'use strict'
let d = require('react').DOM
require('./about.styl')

module.exports = {
  render: (cursor) => {
    return d.div({className: 'pure-g',},
      d.div({className: 'pure-u-1',},
        d.a({href: 'https://github.com/muzhack/muzhack', target: '_blank',},
          d.img({
            style: {position: 'absolute', right: '0', border: '0',},
            src: 'https://camo.githubusercontent.com/365986a132ccd6a44c23a9169022c0b5c890c387/' +
              '68747470733a2f2f73332e616d617a6f6e6177732e636f6d2f6769746875622f726962626f6e732f666' +
              'f726b6d655f72696768745f7265645f6161303030302e706e67', alt: 'Fork me on GitHub',
            'data-canonical-src':
              'https://s3.amazonaws.com/github/ribbons/forkme_right_red_aa0000.png',
          })
        )
      ),
      d.div({className: 'pure-u-1',},
        d.div({id: 'about-pad', className: 'airy-padding-sides',},
          d.h1({}, 'About MuzHack'), d.p({}, 'MuzHack is a joint effort between Arve ' +
          'Knudsen and Notam to produce an online hub for music hardware projects. The goal is ' +
          'for this application to contain descriptions of the outcomes of such projects, and ' +
          'generally facilitate their re-production.')
        )
      )
    )
  },
}
