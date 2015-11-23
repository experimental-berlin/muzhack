'use strict'
let R = require('ramda')
let logger = require('js-logger-aknudsen').get('sharedRouting')

let regex = require('./regex')
let explore = require('./views/explore')
let displayProject = require('./views/project/displayProject')
let login = require('./views/login')
let userProfile = require('./views/userProfile/userProfile')

class NotFoundError {
}

let loadData = (cursor) => {
  let routerState = cursor.cursor('router').toJS()
  let module = routerState.routes[routerState.currentRoute]
  logger.debug(`${routerState.currentRoute} => ${module}:`, routerState)
  let promise
  if (module.loadData != null) {
    logger.debug(`Loading route data...`)
    logger.debug(`Current route args:`, routerState.currentRouteParams)
    cursor = cursor.cursor('router').set('isLoading', true)
    let result = module.loadData(cursor, routerState.currentRouteParams)
    if (result.then != null) {
      promise = result
    } else {
      promise = Promise.resolve(result)
    }
  } else {
    promise = Promise.resolve({})
  }
  return promise
}

module.exports = {
  createRouterState: () => {
    let routes = {
      '/': explore,
      '/u/:user': userProfile,
      '/u/:owner/:projectId': displayProject,
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
  updateRouterState: (cursor, currentPath, shouldLoad) => {
    logger.debug(`Updating router state`)
    logger.debug('Current path:', currentPath)
    let routerState = cursor.cursor('router').toJS()
    let routes = routerState.routes
    let currentRoute = R.find((route) => {
      return new RegExp(route).test(currentPath)
    }, R.keys(routes))
    if (currentRoute == null) {
      logger.debug(
        `Couldn't find route corresponding to path '${currentPath}', throwing NotFoundError`)
      throw new NotFoundError()
    }
    let match = new RegExp(currentRoute).exec(currentPath)
    // Route arguments correspond to regex groups
    let currentRouteParams = R.fromPairs(R.zip(routerState.routeParamNames[currentRoute],
        match.slice(1)))
    logger.debug(`The current path, '${currentPath}', corresponds to route params:`,
      currentRouteParams)

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
    }, routerState.navItems)
    // Default to root nav item being selected
    if (!R.any((navItem) => {return navItem.isSelected}, navItems)) {
      let navItem = R.find((navItem) => {return navItem.path === '/'}, navItems)
      navItem.isSelected = true
    }

    cursor = cursor.mergeDeep({
      router: {
        isLoading: shouldLoad,
        currentRoute,
        currentRouteParams,
        currentPath,
      },
    })

    if (shouldLoad) {
      return loadData(cursor)
        .then((newState) => {
          return [cursor, newState,]
        })
    } else {
      return Promise.resolve([cursor, {},])
    }
  },
  NotFoundError,
}
