'use strict'
let component = require('omniscient')
let logger = require('@arve.knudsen/js-logger').get('components.app')

let Loading = require('../views/loading')
let layout = require('../layout')

if (__IS_BROWSER__) {
  require('./app.styl')
}

module.exports = component('App', (cursor) => {
  logger.debug(`Rendering`)
  let routerState = cursor.cursor('router').toJS()
  logger.debug(`Router state:`, routerState)
  let {currentRoute, routes, currentRouteParams,} = routerState
  let rendering
  if (cursor.cursor('router').get('isLoading')) {
    logger.debug(`Route data is loading, rendering loading page`)
    rendering = layout.render(cursor, Loading())
  } else {
    logger.debug(`Route data is not loading, rendering route page`)
    let page = routes[currentRoute].render.apply(null, [cursor,].concat(currentRouteParams))
    rendering = layout.render(cursor, page)
  }
  return rendering
})
