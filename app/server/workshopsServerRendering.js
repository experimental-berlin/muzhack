'use strict'
let R = require('ramda')
let logger = require('@arve.knudsen/js-logger').get('workshopsServerRendering')
let immutable = require('immutable')
let immstruct = require('immstruct')
let ReactDomServer = require('react-dom/server')
let Boom = require('boom')

let {normalizePath,} = require('../urlUtils')
let explore = require('../views/workshopsExplore')
let login = require('../views/login')
let App = require('../components/app')
let {createRouterState, updateRouterState,} = require('../sharedRouting')
let routeMap = require('../workshopsRouteMap')
let {getEnvParam,} = require('./environment')

let getInitialRouterState = (request, muzhackUri) => {
  let currentPath = request.path
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
    {path: muzhackUri, text: 'MuzHack', isExternal: true,},
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
    navItems,
  })
}

let renderIndex = (request, reply) => {
  logger.debug(`Rendering workshops SPA index, user is logged in: ${
    request.auth.credentials != null}`)
  immstruct.clear()
  let appUri = getEnvParam('APP_URI')
  let cursor = immstruct('state', {
    appUri,
    login: login.createState(),
    explore: explore.createState(),
    router: getInitialRouterState(request, appUri),
    loggedInUser: request.auth.isAuthenticated ? request.auth.credentials : null,
  }).cursor()
  cursor = cursor.mergeDeep({
    router: createRouterState(routeMap),
  })
  return updateRouterState(cursor, request.path, null, request.query)
    .then(([cursor, newState,]) => {
      logger.debug(`Got new state:`, newState)
      cursor = cursor.mergeDeep(R.merge(newState, {
        router: {
          isLoading: false,
        },
      }))
      let initialState = cursor.toJS()
      logger.debug(`Successfully loaded initial state:`, initialState)
      if (initialState.router.shouldRenderServerSide) {
        logger.debug(`Rendering on server - current state:`, cursor.toJS())
        let reactHtml = ReactDomServer.renderToString(App(cursor))
        logger.debug(`Finished rendering`)
        reply.view('workshopsServerSideIndex', {
          initialState: JSON.stringify(initialState),
          reactHtml,
        })
      } else {
        logger.debug(`Not rendering JavaScript on server side`)
        reply.view('workshopsNonServerSideIndex', {
          initialState: JSON.stringify(initialState),
        })
      }
    }, (error) => {
      if (error.statusCode === 404 || error.type === 'notFound') {
        logger.debug(`Current route not recognized`)
        reply(Boom.notFound())
      } else {
        logger.error(`Failed to load initial state: '${error}':`, error.stack)
        reply(Boom.badImplementation())
      }
    })
    .catch((error) => {
      logger.error(`Rendering failed: ${error}`, error.stack)
      reply(Boom.badImplementation())
    })
}

module.exports = {
  renderIndex,
}
