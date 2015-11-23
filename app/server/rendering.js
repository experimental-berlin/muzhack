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
let {createRouterState, updateRouterState, NotFoundError,} = require('../sharedRouting')
let routeMap = require('../routeMap')

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
    navItems,
  })
}

let renderIndex = (request, reply) => {
  let initialState = {
    search: '',
    login: login.createState(),
    explore: explore.createState(),
    userProfile: userProfile.createState(),
    router: getInitialRouterState(request.path),
    loggedInUser: request.auth.credentials,
  }
  let cursor = immstruct('state', initialState).cursor()
  cursor = cursor.mergeDeep({
    router: createRouterState(routeMap),
  })
  return updateRouterState(cursor, request.path, true)
    .then(([cursor, newState,]) => {
      logger.debug(`Got new state:`, newState)
      cursor = cursor.mergeDeep(R.merge(newState, {
        router: {
          isLoading: false,
        },
      }))
      let initialState = cursor.toJS()
      logger.debug(`Successfully loaded initial state:`, initialState)
      logger.debug(`Rendering on server - current state:`, cursor.toJS())
      let reactHtml = ReactDomServer.renderToString(App(cursor))
      logger.debug(`Finished rendering`)
      reply.view('index', {
        initialState: JSON.stringify(initialState),
        reactHtml,
      })
    }, (error) => {
      if (error instanceof NotFoundError) {
        logger.debug(`Current route not recognized`)
        reply(Boom.notFound())
      } else {
        logger.error(`Failed to load initial state: '${error}':`, error.stack)
        reply(Boom.badImplementation())
      }
    })
    .catch((error) => {
      logger.error(`Rendering failed: ${error}`, error.stack)
    })
}

module.exports = {
  renderIndex,
}
