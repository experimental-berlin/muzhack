'use strict'
let R = require('ramda')
let logger = require('js-logger-aknudsen').get('server.rendering')
let immutable = require('immutable')
let immstruct = require('immstruct')
let ReactDomServer = require('react-dom/server')
let Boom = require('boom')

let router = require('../router')
let regex = require('../regex')
let {normalizePath,} = require('../urlUtils')
let explore = require('../views/explore')
let login = require('../views/login')
let userProfile = require('../views/userProfile/userProfile')
let App = require('../components/app')
let {createRouterState, updateRouterState, NotFoundError,} = require('../routerState')

let getInitialRouterState = (currentPath) => {
  if (currentPath === '/u/aknudsen/assets/images/flattr-badge-large.png') {
    throw new Error(`Path is /u/aknudsen/assets/images/flattr-badge-large.png`)
  }
  logger.debug(`Computing initial router state, path is '${currentPath}'`)
  let navItems = R.map((navItem) => {
    let path = !navItem.isExternal ? normalizePath(navItem.path) : navItem.path
    let isSelected = path === currentPath
    logger.debug(`Nav item '${navItem.text}' is selected: ${isSelected}, ${path}`)
    return R.merge(navItem, {
      path,
      isSelected,
    })
  }, [
    {path: '/', text: 'Explore',},
    {path: '/create', text: 'Create',},
    {path: 'http://forums.muzhack.com', text: 'Forums', isExternal: true,},
    {path: '/about', text: 'About',},
  ])
  if (!R.any((navItem) => {return navItem.isSelected}, navItems)) {
    logger.debug(`Defaulting to root nav item being selected`)
    let navItem = R.find((navItem) => {return navItem.path === '/'}, navItems)
    navItem.isSelected = true
  }
  return immutable.fromJS({
    currentPath,
    isLoading: false,
    // routes: mappedRoutes,
    // routeParamNames,
    navItems,
  })
}

module.exports = {
  getInitialState: (request) => {
    let initialState = {
      search: '',
      login: login.createState(),
      explore: explore.createState(),
      userProfile: userProfile.createState(),
      router: getInitialRouterState(request.path),
    }
    let cursor = immstruct('state', initialState).cursor()
    cursor = cursor.mergeDeep({
      router: createRouterState(),
    })
    try {
      cursor = updateRouterState(cursor, request.path)
    } catch (error) {
      if (error instanceof NotFoundError) {
        logger.debug(`Current route not recognized`)
        return Promise.reject(Boom.notFound())
      } else {
        logger.debug(`Unrecognized exception:`, error)
      }
      throw error
    }
    let routerState = cursor.cursor('router').toJS()
    let module = routerState.routes[routerState.currentRoute]
    let promise
    if (module.loadData != null) {
      logger.debug(`Loading route data...`)
      logger.debug(`Current route args:`, routerState.currentRouteParams)
      let result = module.loadData(cursor, routerState.currentRouteParams)
      if (result.then != null) {
        promise = result
      } else {
        promise = Promise.resolve(result)
      }
    } else {
      promise = Promise.resolve({})
    }
    return promise.then((newState) => {
      logger.debug(`Updating cursor with new state:`, newState)
      return cursor.mergeDeep(newState)
    })
  },
  render: (cursor, request) => {
    logger.debug(`Rendering on server - current state:`, cursor.toJS())
    return ReactDomServer.renderToString(App(cursor))
  },
}
