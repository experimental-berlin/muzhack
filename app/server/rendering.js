'use strict'
let R = require('ramda')
let S = require('underscore.string.fp')
let logger = require('js-logger-aknudsen').get('serverRendering')
let immutable = require('immutable')
let immstruct = require('immstruct')
let ReactDomServer = require('react-dom/server')
let Boom = require('boom')
let url = require('url')

let {normalizePath,} = require('../urlUtils')
let explore = require('../views/explore')
let login = require('../views/login')
let userProfile = require('../views/userProfile/userProfile')
let App = require('../components/app')
let {createRouterState, updateRouterState,} = require('../sharedRouting')
let routeMap = require('../routeMap')
let {getEnvParam,} = require('./environment')

let getInitialRouterState = (request, workshopsUri) => {
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
    {path: '/create', text: 'Create',},
    {path: workshopsUri, text: 'Workshops', isExternal: true,},
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
  logger.debug(`Rendering SPA index, user is logged in: ${request.auth.credentials != null}`)
  immstruct.clear()
  let appUri = getEnvParam('APP_URI')
  let appUrlObj = url.parse(appUri)
  let fbAppId = getEnvParam('FB_APP_ID')
  let workshopsUri = `${appUrlObj.protocol}//workshops.${appUrlObj.host}`
  let cursor = immstruct('state', {
    metaHtmlAttributes: {
      'fb:app_id': fbAppId,
      'og:type': 'website',
      'og:title': 'MuzHack',
      'og:description': 'MuzHack is an online hub for the publishing of music hardware projects.',
    },
    search: '',
    appUri,
    login: login.createState(),
    explore: explore.createState(),
    userProfile: userProfile.createState(),
    router: getInitialRouterState(request, workshopsUri),
    loggedInUser: request.auth.isAuthenticated ? request.auth.credentials : null,
    trelloKey: getEnvParam('TRELLO_KEY'),
    stripeKey: getEnvParam('STRIPE_PUBLISHABLE_KEY'),
    gitHubClientId: getEnvParam('GITHUB_CLIENT_ID'),
    fbAppId,
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
      let renderOptions = {
        initialState: JSON.stringify(initialState),
        metaAttributes: R.map(([property, content,]) => {
          return {
            property,
            content,
          }
        }, R.toPairs(initialState.metaHtmlAttributes)),
      }
      if (initialState.router.shouldRenderServerSide) {
        logger.debug(`Rendering on server - current state:`, cursor.toJS())
        let reactHtml = ReactDomServer.renderToString(App(cursor))
        logger.debug(`Finished rendering`)
        reply.view('serverSideIndex', R.merge(renderOptions, {
          reactHtml,
        }))
      } else {
        logger.debug(`Not rendering JavaScript on server side`)
        reply.view('nonServerSideIndex', renderOptions)
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
}

module.exports = {
  renderIndex,
}
