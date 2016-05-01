'use strict'
let R = require('ramda')
let logger = require('js-logger-aknudsen').get('sharedRouting')
let TypedError = require('error/typed')

let regex = require('./regex')

let notFoundError = TypedError({
  type: 'Not Found',
  statusCode: 404,
  message: 'Path not found',
})

let loadData = (cursor, module) => {
  let routerState = cursor.cursor('router').toJS()
  let promise
  if (module.loadData != null) {
    logger.debug(`Loading route data...`)
    logger.debug(`Current route args:`, routerState.currentRouteParams)
    logger.debug(`Current query params:`, routerState.currentQueryParams)
    cursor = cursor.mergeDeep({
      router: {
        isLoading: true,
      },
    })
    let result = module.loadData(cursor, routerState.currentRouteParams,
      routerState.currentQueryParams) || {}
    if (result.then != null) {
      promise = result
    } else {
      promise = Promise.resolve(result)
    }
  } else {
    promise = Promise.resolve({})
  }
  return promise
    .then((result) => {
      return [cursor, result,]
    })
}

module.exports = {
  createRouterState: (routeMap) => {
    let mappedRoutes = {}
    let routeParamNames = {}
    R.forEach((route) => {
      // Replace :[^/]+ with ([^/]+), f.ex. /persons/:id/resource -> /persons/([^/]+)/resource
      let mappedRoute = `^${route.replace(/:\w+/g, '([^/]+)')}$`
      mappedRoutes[mappedRoute] = routeMap[route]
      routeParamNames[mappedRoute] = regex.findAll(':(\\w+)', route)
    }, R.keys(routeMap))
    logger.debug(`Application routes:`, mappedRoutes)
    return {
      routes: mappedRoutes,
      routeParamNames,
    }
  },
  updateRouterState: (cursor, currentPath, currentQueryParams, isInitialClientSideRender) => {
    logger.debug(`Updating router state`)
    logger.debug('Current path:', currentPath)
    let routerState = cursor.cursor('router').toJS()
    let routes = routerState.routes
    let currentRoute = R.find((route) => {
      return new RegExp(route).test(currentPath)
    }, R.keys(routes))
    if (currentRoute == null) {
      logger.debug(
        `Couldn't find route corresponding to path '${currentPath}', throwing notFoundError`)
      return Promise.reject(notFoundError())
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
      return R.merge(navItem, {
        isSelected,
      })
    }, routerState.navItems)
    // Default to root nav item being selected
    if (!R.any((navItem) => {return navItem.isSelected}, navItems)) {
      let navItem = R.find((navItem) => {return navItem.path === '/'}, navItems)
      navItem.isSelected = true
    }

    let module = routerState.routes[currentRoute]
    let shouldRenderServerSide = R.defaultTo(true, module.shouldRenderServerSide)
    let shouldLoad = (__IS_BROWSER__ && (!isInitialClientSideRender || !shouldRenderServerSide)) ||
      shouldRenderServerSide
    cursor = cursor.mergeDeep({
      router: {
        isLoading: shouldLoad,
        currentRoute,
        currentRouteParams,
        currentPath,
        currentQueryParams,
        navItems,
        shouldRenderServerSide,
      },
    })

    if (shouldLoad) {
      return loadData(cursor, module)
    } else {
      logger.debug(`Not loading module data:`, __IS_BROWSER__, shouldRenderServerSide)
      return Promise.resolve([cursor, {},])
    }
  },
}
