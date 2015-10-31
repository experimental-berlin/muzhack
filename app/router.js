'use strict'
let immstruct = require('immstruct')
let component = require('omniscient')
let immutable = require('immutable')
let R = require('ramda')
let S = require('underscore.string.fp')
let layout = require('./layout')
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
  logger.debug('Updating route')
  let cursor = getState()
  cursor.cursor('router').update((routerState) => {
    let currentPath = getCurrentPath()
    logger.debug('Current path is:', currentPath)
    return routerState.merge({
      currentPath,
      navItems: routerState.get('navItems').map((navItem) => {
        let path = navItem.get('path')
        let isSelected = path === currentPath
        if (isSelected) {
          logger.debug(`Nav item with path '${path}' is selected`)
        }
        return navItem.merge({isSelected: isSelected,})
      }),
    })
  })
}

// TODO
window.onpopstate = () => {
  logger.debug('onpopstate')
  updateRoute()
}

let handleClick = (e) => {
  if (getEventWhich(e) !== 1) {
    return
  }

  if (e.metaKey || e.ctrlKey || e.shiftKey || e.defaultPrevented) {
    return
  }

  // ensure link
  let el = e.target
  while (el && 'A' !== el.nodeName) el = el.parentNode
  if (!el || 'A' !== el.nodeName) {
    return
  }

  // Ignore if tag has
  // 1. "download" attribute
  // 2. rel="external" attribute
  if (el.hasAttribute('download') || el.getAttribute('rel') === 'external') {
    return
  }

  // ensure non-hash for the same path
  let link = el.getAttribute('href')
  if (el.pathname === location.pathname && (el.hash || '#' === link)) {
    return
  }

  // Check for mailto: in the href
  if (link && link.indexOf('mailto:') > -1) {
    return
  }

  // check target
  if (el.target) {
    return
  }

  // x-origin
  if (!sameOrigin(el.href)) {
    return
   }

  // rebuild path
  let path = el.pathname + el.search + (el.hash || '')

  // strip leading "/[drive letter]:" on NW.js on Windows
  if (typeof process !== 'undefined' && path.match(/^\/[a-zA-Z]:\//)) {
    path = path.replace(/^\/[a-zA-Z]:\//, '/')
  }

  // same page
  let orig = path
  let basePath = ''

  if (path.indexOf(basePath) === 0) {
    path = path.substr(basePath.length)
  }

  if (basePath && orig === path) {
    return
  }

  e.preventDefault()
  logger.debug(`Navigating to '${orig}'`)
  window.history.pushState({}, 'MuzHackage', orig)
  updateRoute()
}

let clickEvent = document != null && document.ontouchstart ? 'touchstart' : 'click'
document.addEventListener(clickEvent, handleClick, false)

let getEventWhich = (e) => {
  e = e || window.event
  return e.which == null ? e.button : e.which
}

/**
 * Check if `href` is the same origin.
 */
function sameOrigin(href) {
  let origin = location.protocol + '//' + location.hostname
  if (location.port) origin += ':' + location.port
  return (href && (0 === href.indexOf(origin)))
}

let Router = component('Router', (cursor) => {
  logger.debug('Router rendering')
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
  return layout.render(cursor, page)
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
