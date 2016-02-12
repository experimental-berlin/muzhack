'use strict'
let h = require('react-hyperscript')
let R = require('ramda')
let S = require('underscore.string.fp')
let component = require('omniscient')

let userManagement = require('./userManagement')
let Modal = require('./views/modal')

let flattrImage
if (__IS_BROWSER__) {
  require('purecss/build/pure.css')
  require('normalize.css/normalize.css')
  require('./layout.styl')
  require('./bitcoinate.styl')
}

let logger = require('js-logger-aknudsen').get('layout')

let WarningDialog = component('WarningDialog', ({cursor, title, message,}) => {
  let closeCallback = () => {
    cursor.set('showWarningDialog', null)
  }

  logger.debug(`Rendering WarningDialog:`, message)
  let content = h('div', [
    h('.modal-body-content', [
      message,
    ]),
    h('.button-group', [
      h('button.pure-button.pure-button-primary', {
        onClick: () => {
          logger.debug(`OK button clicked`)
          closeCallback()
        },
      }, 'OK'),
    ]),
  ])

  return Modal({title, content, closeCallback,})
})

let Bitcoinate = component('Bitcoinate', () => {
  return h('button.bitcoinate', {
    'data-size': '20',
    'data-address': '3BPwSKv5fku9CFJRzb1JWiiKvTz7KaD3Go',
    onClick: () => {
      logger.debug(`Bitcoinate clicked`)
      window.prompt(`Please donate bitcoins to: `, '3BPwSKv5fku9CFJRzb1JWiiKvTz7KaD3Go')
    },
  }, [
    h('span.bitcoinate-image'),
    'bitcoinate',
  ])
})

let AccountBar = component('AccountBar', (cursor) => {
  let user = userManagement.getLoggedInUser(cursor)
  let isLoggedIn = user != null
  if (isLoggedIn) {
    logger.debug(`AccountBar: logged in user:`, user)
  } else {
    logger.debug(`User isn't logged in`)
  }
  let links = isLoggedIn ? [
    h('a.toolbar-btn.enabled.pure-menu-link', {href: `/u/${user.username}`,}, [
      h('span.icon-user', {
        'data-tooltip': 'Go to your account',
        'data-tooltip-direction': 's',
        'data-tooltip-top': 18,
      }),
    ]),
    h('a#logout.toolbar-btn.enabled.pure-menu-link', {
      href: '/logout',
      'data-tooltip': 'Log out',
      'data-tooltip-top': '18',
      'data-tooltip-direction': 's',
    }, [
      h('span.icon-exit3'),
    ]),
  ] : [
    h('a#login.toolbar-btn.enabled.pure-menu-link', {
      href: '/login',
      'data-tooltip': 'Log in',
      'data-tooltip-direction': 's',
    }, [
      h('span.icon-enter3'),
    ]),
  ]
  return h('.pull-right', [
    h('.accountbar', [
      h('ul.pure-menu-list', R.map((link) => {
        return h('li.pure-menu-item', [link,])
      }, links)),
    ]),
  ])
})

let Header = component('Header', (cursor) => {
  logger.debug('Header rendering')
  let navItems = cursor.cursor(['router', 'navItems',]).toJS()
  logger.debug('Nav items:', navItems)
  return h('header', [
    h('nav#menu.pure-menu.pure-menu-open.pure-menu-fixed.pure-menu-horizontal', [
      h('a.pure-menu-heading', {href: '/',}, h('span.icon-Muzhack_logo1')),
      h('ul.pure-menu-list', R.addIndex(R.map)((navItem, i) => {
        let classes = ['pure-menu-item', navItem.isSelected ? 'pure-menu-selected' : null,]
        let extraAttrs = navItem.isExternal ? {target: '_blank',} : {}
        return h(`li.${S.join('.', classes)}`, [
          h('a.pure-menu-link', R.merge({href: navItem.path,}, extraAttrs), navItem.text),
        ])
      }, navItems)),
      AccountBar(cursor),
    ]),
  ])
})

let Footer = component('Footer', () => {
  return h('footer', [
    h('p', 'MuzHack beta, enjoy responsibly.'),
    h('p', [
      '© 2016 ',
      h('a', {href: 'http://arveknudsen.com', target: '_blank',}, 'Arve Knudsen'),
    ]),
    h('p', [
      h('a.social-link', {href: 'https://twitter.com/muzhack', target: '_blank',}, [
        h('span.icon-twitter'),
      ]),
      h('a.social-link', {href: 'https://github.com/muzhack/muzhack', target: '_blank',}, [
        h('span.icon-github'),
      ]),
      h('a.social-link', {href: 'mailto:contact@muzhack.com', target: '_blank',}, [
        h('span.icon-envelop3'),
      ]),
    ]),
    h('#donations', [
      h('form.paypal-form', {
        action: 'https://www.paypal.com/cgi-bin/webscr', method: 'post', target: '_blank',
      }, [
        h('input', {type: 'hidden', name: 'cmd', value: '_s-xclick',}),
        h('input', {type: 'hidden', name: 'hosted_button_id', value: 'CK63W27QE75KW',}),
        h('input.paypal-button', {
          type: 'image',
          src: 'https://www.paypalobjects.com/en_US/i/btn/btn_donate_LG.gif',
          border: '0', name: 'submit', alt: 'PayPal - The safer, easier way to pay online!',
        }),
      ]),
      h('a.flatter-link', {
        href: 'https://flattr.com/submit/auto?user_id=muzhack&url=https://github.com/muzhack/muzhack&title=MuzHack&description=MuzHack&tags=muzhack,programming&category=text',
        target: '_blank',
      }, [
        h('img', {src: '/assets/images/flattr-badge-large.png', alt: 'Flattr MuzHack',}),
      ]),
      Bitcoinate(),
    ]),
  ])
})

module.exports.render = (cursor, page) => {
  logger.debug(`Layout rendering`)
  let showWarningDialog = cursor.get('showWarningDialog')
  return h('div', [
    showWarningDialog != null ? WarningDialog({
      cursor,
      title: showWarningDialog.title,
      message: showWarningDialog.message,
    }) : null,
    Header(cursor),
    h('#content', [page,]),
    Footer(),
  ])
}
