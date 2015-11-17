'use strict'
let R = require('ramda')
let logger = require('js-logger-aknudsen').get('server.rendering')
let immutable = require('immutable')
let immstruct = require('immstruct')
let ReactDomServer = require('react-dom/server')

let router = require('../router')
let regex = require('../regex')
let {normalizePath,} = require('../urlUtils')
let explore = require('../views/explore')
let login = require('../views/login')
let userProfile = require('../views/userProfile/userProfile')
let App = require('../components/app')
let {createRouterState, updateRouterState,} = require('../routerState')

let getInitialRouterState = (currentPath) => {
  logger.debug(`Computing initial router state, path is '${currentPath}'`)
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
    cursor = updateRouterState(cursor, request.path)
    let routerState = cursor.cursor('router').toJS()
    let module = routerState.routes[routerState.currentRoute]
    let promise
    if (module.loadData != null) {
      logger.debug(`Loading route data...`)
      let result = module.loadData(cursor)
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
      return [initialState, cursor.mergeDeep(newState),]
    })
  },
  render: (cursor, request) => {
    logger.debug(`Rendering on server - current state:`, cursor.toJS())
    return ReactDomServer.renderToString(App(cursor))
  },
}
