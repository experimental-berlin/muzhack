'use strict'
let immstruct = require('immstruct')
let component = require('omniscient')
let immutable = require('immutable')
let React = require('react')
let d = React.DOM
let R = require('ramda')
let S = require('underscore.string.fp')
require('purecss/build/pure.css')
require('./layout.styl')
let logger = require('js-logger').get('router')

let getState = () => {
  return immstruct('state')
}

let normalizePath = (path) => {
  if (path[0] !== '/') {
    path = `/${path}`
  }
  return path
}

// Make URL relative
let getRelativeUrl = (url) => {
  return url.replace(/^(?:\/\/|[^\/]+)*\/?/, '')
}

// Get path component of the current URL
let getCurrentPath = () => {
  let link = document.createElement('a')
  link.href = document.location
  return normalizePath(link.pathname)
}

let updateRoute = () => {
  let cursor = getState()
  currentPath = getCurrentPath()
  cursor.cursor(['router', 'navItems',]).update((x) => {
    let isSelected = false
    if (x.path === currentPath) {
      isSelected = true
    }
    logger.debug(`Nav item with path '${x.path}' is selected: ${isSelected}`)
    return R.merge(x, {isSelected: isSelected,})
  })
  cursor.cursor('router').set('currentPath', currentPath)
}

// TODO
window.onpopstate = () => {
  logger.debug('onpopstate')
  updateRoute()
}

let toClassName = (classes) => {
  return S.join(' ', R.filter((x) => {return x != null}, classes))
}

let renderWithLayout = (cursor, page) => {
  let navItems = cursor.cursor(['router', 'navItems',]).toJS()
  logger.debug('Nav items:', navItems)
  return d.div({},
    d.header({},
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
    ),
    d.div({id: 'content',}, page),
    d.footer({},
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
      )
    )
  )

//   +googletagmanager
// header
//   nav#menu.pure-menu.pure-menu-open.pure-menu-fixed.pure-menu-horizontal
//     a.pure-menu-heading(href='/') #{appName}
//     ul
//       each menuElements
//         li($dyn=attrs)
//           a(href=url $dyn=linkAttrs) #{name}
//     .pull-right
//       .search-box
//         span#navbar-do-search.search-icon.icon-search.muted
//         input#navbar-search-input(placeholder='Search MuzHack', value=searchQuery)
//         if hasSearchQuery
//           span#navbar-clear-search.clear-icon.icon-cross.muted
//       +accountbar
// article
//   #content
//     +yield
// footer
//   p MuzHack beta, enjoy responsibly.
//   p © 2015 #[a(href='http://arveknudsen.com' target='_blank') Arve Knudsen]
//   p
//     a.social-link(href='https://twitter.com/muzhack', target='_blank')
//       span.icon-twitter
//     a.social-link(href='', target='_blank')
//       span.icon-github
//     a.social-link(href='', target='_blank')
//       span.icon-envelop3
//   +donations
//
// +tooltips
}

let Router = component('Router', (cursor) => {
  let routes = cursor.cursor(['router', 'routes',]).toJS()
  logger.debug('Current router state:', cursor.cursor(['router', 'currentPath',]).toJS())
  let route = getCurrentRoute(routes)
  let path = cursor.cursor(['router', 'currentPath',]).deref() || getCurrentPath()
  logger.debug('Current path:', path)
  let match = new RegExp(route).exec(path)
  // Route arguments correspond to regex groups
  let args = match.slice(1)
  let func = routes[route]
  logger.debug('Calling function with args:', args)
  let page = func.apply(null, [cursor,].concat(args))
  return renderWithLayout(cursor, page)
})

let getCurrentRoute = (routes) => {
  let path = getCurrentPath()
  let route = R.find((route) => {
    return new RegExp(route).test(path)
  }, R.keys(routes))
  if (route == null) {
    throw new Error(`Couldn't find route corresponding to path '${path}'`)
  }
  return route
}

module.exports = {
  Router,
  createState: (routes) => {
    let currentPath = getCurrentPath()
    let mappedRoutes = {}
    R.forEach((route) => {
      // Replace :[^/]+ with ([^/]+), f.ex. /persons/:id/resource -> /persons/([^/]+)/resource
      mappedRoutes[`^${route.replace(/:\w+/g, '([^/]+)')}$`] = routes[route]
    }, R.keys(routes))
    logger.debug(`Application routes:`, mappedRoutes)
    return immutable.fromJS({
      routes: mappedRoutes,
      navItems: R.map((x) => {
        let path = !x.isExternal ? normalizePath(x.path) : x.path
        return R.merge(x, {
          path: path,
          isSelected: path === currentPath,
        })
      }, [
        {path: '/', text: 'Explore',},
        {path: '/create', text: 'Create',},
        {path: 'http://forums.muzhack.com', text: 'Forums', isExternal: true,},
        {path: '/about', text: 'About',},
      ]),
    })
  },
  route: (path, func, cursor) => {
    let routesCursor = getState().cursor(['router', 'routes',])
    // Replace :[^/]+ with ([^/]+), f.ex. /persons/:id/resource -> /persons/([^/]+)/resource
    let route = `^${path.replace(/:\w+/g, '([^/]+)')}$`
    routesCursor.set(route, func)
    return module.exports
  },
  // Navigate to a path
  navigate: (path, data, title) => {
    let currentState = history.state
    let currentUrl = currentState.url
    let currentData = currentState.data
    let currentTitle = currentState.title || undefined
    // Normalize these as undefined if they're empty, different
    // browsers may return different values
    if (R.isEmpty(R.keys(currentData))) {
      currentData = undefined
    }
    if (path[0] !== '/') {
      let currentPath = getCurrentPath()
      // Make absolute path
      if (currentPath.slice(-1)[0] !== '/') {
        currentPath += '/'
      }
      path = currentPath + path
    }

    if (path !== normalizePath(getRelativeUrl(currentUrl)) || data !== currentData ||
        title !== currentTitle) {
      history.pushState(data, title, path)
    } else {
      updateRoute()
    }
    return this
  },
  back: () => {
    history.back()
    return this
  },
  go: (steps) => {
    history.go(steps)
    return this
  },
}
