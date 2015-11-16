'use strict'
let R = require('ramda')
let logger = require('js-logger-aknudsen').get('routerState')

let regex = require('./regex')
let explore = require('./views/explore')
let login = require('./views/login')
let userProfile = require('./views/userProfile/userProfile')

module.exports = () => {
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
}
