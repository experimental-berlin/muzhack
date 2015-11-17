'use strict'
let R = require('ramda')
let logger = require('js-logger-aknudsen').get('routerState')

let regex = require('./regex')
let explore = require('./views/explore')
let login = require('./views/login')
let userProfile = require('./views/userProfile/userProfile')

module.exports = {
  createRouterState: () => {
    let routes = {
      '/': explore,
      '/u/:user': userProfile,
      // '/u/:owner/:projectId': displayProject.routeOptions,
      // '/u/:owner/:projectId/edit': editProject.routeOptions,
      // '/create': createProject.routeOptions,
      // '/about': about.render,
      '/login': login,
      // '/logout': logout.render,
      // '/account/forgotpassword': forgotPassword.routeOptions,
      // '/discourse/sso': discourse.routeOptions,
    }
    let mappedRoutes = {}
    let routeParamNames = {}
    R.forEach((route) => {
      // Replace :[^/]+ with ([^/]+), f.ex. /persons/:id/resource -> /persons/([^/]+)/resource
      let mappedRoute = `^${route.replace(/:\w+/g, '([^/]+)')}$`
      mappedRoutes[mappedRoute] = routes[route]
      routeParamNames[mappedRoute] = regex.findAll(':(\\w+)', route)
    }, R.keys(routes))
    logger.debug(`Application routes:`, mappedRoutes)
    return {
      routes: mappedRoutes,
      routeParamNames,
    }
  },
  updateRouterState: (cursor, currentPath) => {
    logger.debug(`Updating router state`)
    logger.debug('Current path:', currentPath)
    let routerState = cursor.cursor('router').toJS()
    let routes = routerState.routes
    let currentRoute = R.find((route) => {
      return new RegExp(route).test(currentPath)
    }, R.keys(routes))
    if (currentRoute == null) {
      throw new Error(`Couldn't find route corresponding to path '${currentPath}'`)
    }
    let match = new RegExp(currentRoute).exec(currentPath)
    // Route arguments correspond to regex groups
    let currentRouteArgs = match.slice(1)
    return cursor.mergeDeep({
      router: {
        currentRoute,
        currentRouteArgs,
      },
    })
  },
}
