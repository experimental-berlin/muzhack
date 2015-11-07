'use strict'
let immstruct = require('immstruct')
let component = require('omniscient')
let immutable = require('immutable')
let R = require('ramda')
let S = require('underscore.string.fp')
let layout = require('./layout')
let logger = require('js-logger').get('router')

let Loading = require('./loading')
let regex = require('./regex')

let getState = () => {
  return immstruct('state').cursor()
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

let loadData = (cursor) => {
  let routerCursor = cursor.cursor('router')
  let routes = routerCursor.get('routes').toJS()
  let route = getCurrentRoute(routes)
  let func = routes[route]
  if (typeof func !== 'function') {
    logger.debug(`Loading route data before rendering`)
    let path = getCurrentPath()
    let routeParamNames = routerCursor.get('routeParamNames').toJS()[route]
    let match = new RegExp(route).exec(path)
    let routeParams = match.slice(1)
    let params = R.fromPairs(R.zip(routeParamNames, routeParams))
    logger.debug(`Current route parameters:`, params)
    func.loadData(cursor, params)
      .then((newState) => {
        logger.debug(`Route data has been loaded ahead of rendering, new state:`, newState)
        let mergedState = getState().mergeDeep(R.merge(newState, {
          router: {
            isLoading: false,
          },
        }))
      })

    return true
  } else {
    return false
  }
}

let goTo = (path) => {
  logger.debug(`Navigating to '${path}'`)
  window.history.pushState({}, 'MuzHack', path)
  perform()
}

let requiresLogin = (cursor) => {
  let routerCursor = cursor.cursor('router')
  let routes = routerCursor.get('routes').toJS()
  let route = getCurrentRoute(routes)
  let options = routes[route]
  if (typeof options === 'function' || !options.requiresLogin) {
    logger.debug(`Route doesn't require login`)
    return false
  } else if (cursor.get('loggedInUser') == null) {
    logger.debug(`Route requires user being logged in - redirecting to login page`)
    return true
  }
}

let perform = () => {
  let cursor = getState()
  let currentPath = getCurrentPath()
  logger.debug('Routing, current path:', currentPath)
  let routerCursor = cursor.cursor('router')
  if (requiresLogin(cursor)) {
    goTo('/login')
  } else {
    let isLoading = loadData(cursor)
    let navItems = R.map((navItem) => {
      let path = navItem.path
      let isSelected = path === currentPath
      if (isSelected) {
        logger.debug(`Nav item with path '${path}' is selected`)
      }
      return {
        isSelected,
        path,
      }
    }, routerCursor.get('navItems').toJS())
    // Default to root nav item being selected
    if (!R.any((navItem) => {return navItem.isSelected}, navItems)) {
      let navItem = R.find((navItem) => {return navItem.path === '/'}, navItems)
      navItem.isSelected = true
    }
    routerCursor.mergeDeep({
      isLoading,
      currentPath,
      navItems,
    })
  }
}

window.onpopstate = () => {
  logger.debug('onpopstate')
  perform()
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
  goTo(orig)
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
  logger.debug('Current state:', cursor.toJS())
  let route = getCurrentRoute(routes)
  let path = cursor.cursor('router').get('currentPath')
  logger.debug('Current path:', path)
  let match = new RegExp(route).exec(path)
  // Route arguments correspond to regex groups
  let args = match.slice(1)
  let page
  if (cursor.cursor('router').get('isLoading')) {
    logger.debug(`Route data is loading`)
    page = Loading()
  } else {
    let func = routes[route]
    if (typeof func !== 'function') {
      func = func.render
    }
    logger.debug('Calling function with args:', args)
    page = func.apply(null, [cursor,].concat(args))
  }
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
    let routeParamNames = {}
    R.forEach((route) => {
      // Replace :[^/]+ with ([^/]+), f.ex. /persons/:id/resource -> /persons/([^/]+)/resource
      let mappedRoute = `^${route.replace(/:\w+/g, '([^/]+)')}$`
      mappedRoutes[mappedRoute] = routes[route]
      routeParamNames[mappedRoute] = regex.findAll(':(\\w+)', route)
    }, R.keys(routes))
    logger.debug(`Application routes:`, mappedRoutes)

    return immutable.fromJS({
      currentPath,
      isLoading: false,
      routes: mappedRoutes,
      routeParamNames,
      navItems: R.map((navItem) => {
        let path = !navItem.isExternal ? normalizePath(navItem.path) : navItem.path
        return R.merge(navItem, {
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
  perform,
  goTo,
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
      perform()
    }
    return this
  },
}
