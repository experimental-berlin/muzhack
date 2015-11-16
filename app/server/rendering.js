'use strict'
let R = require('ramda')
let logger = require('js-logger-aknudsen').get('server.rendering')
let immutable = require('immutable')

let router = require('../router')
let regex = require('../regex')
let {normalizePath,} = require('../urlUtils')
let explore = require('../views/explore')
let login = require('../views/login')
let userProfile = require('../views/userProfile/userProfile')

let createRouterState = (currentPath) => {
  logger.debug(`Computing initial router state, path is '${currentPath}'`)
  // let mappedRoutes = {}
  // let routeParamNames = {}
  // R.forEach((route) => {
  //   // Replace :[^/]+ with ([^/]+), f.ex. /persons/:id/resource -> /persons/([^/]+)/resource
  //   let mappedRoute = `^${route.replace(/:\w+/g, '([^/]+)')}$`
  //   mappedRoutes[mappedRoute] = routes[route]
  //   routeParamNames[mappedRoute] = regex.findAll(':(\\w+)', route)
  // }, R.keys(routes))
  // logger.debug(`Application routes:`, mappedRoutes)

  return immutable.fromJS({
    currentPath,
    isLoading: false,
    // routes: mappedRoutes,
    // routeParamNames,
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
}

module.exports.getInitialState = (request) => {
  return JSON.stringify({
    search: '',
    login: login.createState(),
    // explore: explore.createState(),
    userProfile: userProfile.createState(),
    router: createRouterState(request.path),
  })
}
