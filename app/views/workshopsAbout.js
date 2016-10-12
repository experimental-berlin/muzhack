'use strict'
let h = require('react-hyperscript')
let logger = require('@arve.knudsen/js-logger').get('workshopsAbout')

if (__IS_BROWSER__) {
  require('./about.styl')
}

module.exports = {
  render: (cursor) => {
    logger.debug(`Rendering`)
    return h('.pure-g', [
      h('.pure-u-1', [
        h('a', {href: 'https://github.com/muzhack/muzhack', target: '_blank',}, [
          h('img', {
            style: {position: 'absolute', right: 0, border: 0,},
            src: 'https://camo.githubusercontent.com/365986a132ccd6a44c23a9169022c0b5c890c387/' +
              '68747470733a2f2f73332e616d617a6f6e6177732e636f6d2f6769746875622f726962626f6e732f666' +
              'f726b6d655f72696768745f7265645f6161303030302e706e67',
            alt: 'Fork me on GitHub',
            'data-canonical-src':
              'https://s3.amazonaws.com/github/ribbons/forkme_right_red_aa0000.png',
          }),
        ]),
      ]),
      h('.pure-u-1', [
        h('#about-pad', [
          h('h1', 'About MuzHack Workshops'),
          h('p', [
            `MuzHack Workshops is a service for finding experts leading workshops within the
            field of music in general and and music technology specifically. It also helps
            in finding workshops themselves, both upcoming ones and ones that have already
            taken place. This service is developed as part of the `,
            h('a', {href: `https://muzhack.com`,}, `MuzHack project`), `.`,
          ]),
        ]),
      ]),
    ])
  },
}
