'use strict'
let immstruct = require('immstruct')
let component = require('omniscient')
let immutable = require('immutable')
let R = require('ramda')

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
  let cursor = getState().cursor(['router',])
  cursor.set('currentPath', getCurrentPath())
}

// TODO
window.onpopstate = () => {
  console.log('onpopstate')
  updateRoute()
}

let Router = component('Router', (cursor) => {
  let routes = cursor.cursor(['router', 'routes',]).toJS()
  console.log('Current router state:', cursor.cursor(['router', 'currentPath',]).toJS())
  let path = cursor.cursor(['router', 'currentPath',]).deref() || getCurrentPath()
  console.log('Current path:', path)
  let route = R.find((route) => {
    return new RegExp(route).test(path)
  }, R.keys(routes))
  if (route == null) {
    throw new Error(`Couldn't find route corresponding to path '${path}'`)
  }
  let match = new RegExp(route).exec(path)
  // Route arguments correspond to regex groups
  let args = match.slice(1)
  let func = routes[route]
  console.log('Calling function with args:', args)
  return func.apply(null, [cursor,].concat(args))
})

module.exports = {
  Router,
  createState: () => {
    return immutable.fromJS({
      routes: immutable.fromJS({}),
    })
  },
  route: (path, func, cursor) => {
    let routesCursor = getState().cursor(['router', 'routes',])
    path = normalizePath(path)
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
