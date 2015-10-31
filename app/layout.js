'use strict'
let d = require('react').DOM
let R = require('ramda')
let S = require('underscore.string.fp')
let component = require('omniscient')

require('purecss/build/pure.css')
require('normalize.css/normalize.css')
require('./layout.styl')

let logger = require('js-logger').get('layout')

let toClassName = (classes) => {
  return S.join(' ', R.filter((x) => {return x != null}, classes))
}

let Header = component('Header', (cursor) => {
  logger.debug('Header rendering')
  let navItems = cursor.cursor(['router', 'navItems',]).toJS()
  logger.debug('Nav items:', navItems)
  return d.header({},
    d.nav({id: 'menu', className: 'pure-menu pure-menu-open pure-menu-fixed pure-menu-horizontal',},
      d.a({className: 'pure-menu-heading', href: '/',}, 'MuzHack'),
      d.ul({className: 'pure-menu-list',}, R.addIndex(R.map)((x, i) => {
        let classes = ['pure-menu-item', x.isSelected ? 'pure-menu-selected' : null,]
        let extraAttrs = x.isExternal ? {target: '_blank',} : {}
        return d.li({className: toClassName(classes), key: i,},
          d.a(R.merge({className: 'pure-menu-link', href: x.path,}, extraAttrs), x.text)
        )
      }, navItems))
    )
  )
})

let Footer = component('Footer', () => {
  return d.footer({},
    d.p({}, 'MuzHack beta, enjoy responsibly.'),
    d.p({}, '© 2015 ', d.a({href: 'http://arveknudsen.com', target: '_blank',}, 'Arve Knudsen')),
    d.p({},
      d.a({className: 'social-link', href: 'https://twitter.com/muzhack', target: '_blank',},
        d.span({className: 'icon-twitter',})
      ),
      d.a({className: 'social-link', href: 'https://github.com/muzhack/muzhack', target: '_blank',},
        d.span({className: 'icon-github',})
      ),
      d.a({className: 'social-link', href: 'mailto:contact@muzhack.com', target: '_blank',},
        d.span({className: 'icon-envelop3',})
      )
    ),
    d.div(
      {id: 'donations',},
      d.form(
        {
          className: 'paypal-form', action: 'https://www.paypal.com/cgi-bin/webscr',
          method: 'post', target: '_blank',
        },
        d.input({type: 'hidden', name: 'cmd', value: '_s-xclick',}),
        d.input({type: 'hidden', name: 'hosted_button_id', value: 'CK63W27QE75KW',}),
        d.input(
          {
            className: 'paypal-button', type: 'image',
            src: 'https://www.paypalobjects.com/en_US/i/btn/btn_donate_LG.gif',
            border: '0', name: 'submit', alt: 'PayPal - The safer, easier way to pay online!',
          }
        )
      ),
      d.a(
        {
          className: 'flatter-link',
          href: 'https://flattr.com/submit/auto?user_id=muzhack&url=https://github.com/muzhack/muzhack&title=MuzHack&description=MuzHack&tags=muzhack,programming&category=text',
          target: '_blank',
        },
        d.img(
          {src: 'https://api.flattr.com/button/flattr-badge-large.png', alt: 'Flattr MuzHack',}
        )
      ),
      d.button(
        {
          className: 'bitcoinate', 'data-size': '20',
          'data-address': '3BPwSKv5fku9CFJRzb1JWiiKvTz7KaD3Go',
        }, 'bitcoinate'
      )
    )
  )
})

module.exports.render = (cursor, page) => {
  logger.debug(`Layout rendering`)
  return d.div({},
    Header(cursor),
    d.div({id: 'content',}, page),
    Footer()
  )
}
