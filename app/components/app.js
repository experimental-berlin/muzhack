'use strict'
let component = require('omniscient')
let logger = require('js-logger-aknudsen').get('components.app')

let Loading = require('../views/loading')
let layout = require('../layout')

module.exports = component('App', (cursor) => {
  logger.debug(`Rendering`)
  let routerState = cursor.cursor('router').toJS()
  logger.debug(`Router state:`, routerState)
  let {currentRoute, routes, currentRouteParams,} = routerState
  let func = routes[currentRoute].render
  let page
  if (cursor.cursor('router').get('isLoading')) {
    logger.debug(`Route data is loading`)
    page = Loading()
  } else {
    page = func.apply(null, [cursor,].concat(currentRouteParams))
  }
  return layout.render(cursor, page)
})
