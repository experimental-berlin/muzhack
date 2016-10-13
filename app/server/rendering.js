'use strict'
let map = require('ramda/src/map')
let omit = require('ramda/src/omit')
let merge = require('ramda/src/merge')
let any = require('ramda/src/any')
let pipe = require('ramda/src/pipe')
let filter = require('ramda/src/filter')
let find = require('ramda/src/find')
let fromPairs = require('ramda/src/fromPairs')
let toPairs = require('ramda/src/toPairs')
let flatten = require('ramda/src/flatten')
let S = require('underscore.string.fp')
let logger = require('@arve.knudsen/js-logger').get('serverRendering')
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
  let navItems = map((navItem) => {
    let path = !navItem.isExternal ? normalizePath(navItem.path) : navItem.path
    let isSelected = path === currentPath
    logger.debug(`Nav item '${navItem.text}' is selected: ${isSelected}, ${path}`)
    return merge(navItem, {
      path,
      isSelected,
    })
  }, [
    {path: '/', text: 'Explore',},
    {path: '/create', text: 'Create',},
    // TODO: Enable
    // {path: workshopsUri, text: 'Workshops', isExternal: true,},
    {path: 'http://forums.muzhack.com', text: 'Forums', isExternal: true,},
    {path: '/about', text: 'About',},
  ])
  if (!any((navItem) => {return navItem.isSelected}, navItems)) {
    logger.debug(`Defaulting to root nav item being selected`)
    let navItem = find((navItem) => {return navItem.path === '/'}, navItems)
    navItem.isSelected = true
  }
  return immutable.fromJS({
    currentPath,
    isLoading: false,
    navItems,
  })
}

let renderIndex = (request, reply) => {
  let cookie = request.headers.cookie || ''
  let authCookie = pipe(
    map((element) => {
      return /([^=]+)=(.+)/.exec(element).slice(1)
    }),
    filter(([key,]) => {
      logger.debug(`Got key '${key}'`)
      return key === 'sid'
    }),
    fromPairs
  )(cookie.split(/; /)).sid
  logger.debug(`Rendering SPA index, user is logged in: ${request.auth.credentials != null}`)
  immstruct.clear()
  let appUri = getEnvParam('APP_URI')
  let appUrlObj = url.parse(appUri)
  let fbAppId = getEnvParam('FB_APP_ID')
  let workshopsUri = `${appUrlObj.protocol}//workshops.${appUrlObj.host}`
  let cursor = immstruct('state', {
    metaHtmlAttributes: {
      name: {
        viewport: 'width=device-width, initial-scale=1.0',
        description: 'An online hub for the free sharing of music hardware projects.',
      },
      property: {
        'fb:app_id': fbAppId,
        'og:type': 'website',
        'og:title': 'MuzHack',
        'og:description': 'MuzHack is an online hub for the publishing of music hardware projects.',
        'og:image': 'https://muzhack.com/assets/images/muzhack.png',
      },
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
    authCookie,
  }).cursor()
  cursor = cursor.mergeDeep({
    router: createRouterState(routeMap),
  })
  return updateRouterState(cursor, request.path, null, request.query)
    .then(([cursor, newState,]) => {
      // logger.debug(`Got new state:`, newState)
      cursor = cursor.mergeDeep(merge(newState, {
        router: {
          isLoading: false,
        },
      }))
      let initialState = cursor.toJS()
      logger.debug(`Successfully loaded initial state:`, initialState)
      let metaAttributes = flatten(
        map(([attrType, attr2content,]) => {
          return map(([attr, content,]) => {
            let obj = {}
            obj[attrType] = attr
            obj.content = content
            return obj
          }, toPairs(attr2content))
        }, toPairs(initialState.metaHtmlAttributes))
      )
      let isProduction = getEnvParam('APP_ENVIRONMENT') === 'production'
      let renderOptions = {
        initialState: JSON.stringify(omit(['authCookie',], initialState)),
        metaAttributes,
        isProduction,
      }
      if (initialState.router.shouldRenderServerSide) {
        logger.debug(`Rendering on server - current state:`, cursor.toJS())
        let reactHtml = ReactDomServer.renderToString(App(cursor))
        logger.debug(`Finished rendering`)
        reply.view('serverSideIndex', merge(renderOptions, {
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
