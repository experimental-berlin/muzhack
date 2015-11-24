'use strict'
let immstruct = require('immstruct')
let ReactDom = require('react-dom')
let router = require('./router')
let Logger = require('js-logger-aknudsen')

let ajax = require('./client/ajax')
let routeMap = require('./routeMap')

require('./app.styl')
require('./styles/fonts.css')

Logger.useDefaults()
Logger.setHandler((messages, context) => {
  if (context.level === Logger.ERROR) {
    ajax.postJson('logError', {
      error: messages[0],
    })
  }

  Logger.getDefaultHandler()(messages, context)
})

let logger = Logger.get('entry')

window.onerror = (message, url, line) => {
  logger.error(`Uncaught exception, at ${url}:${line}:\n${message}`)
}

let initialState = JSON.parse(document.getElementById('initial-state').getAttribute('data-json'))
logger.debug(`Initial state as rendered by server:`, initialState)
let structure = immstruct('state', initialState)
router.performInitial(structure.cursor(), routeMap)

let render = () => {
  ReactDom.render(router.Router(structure.cursor()), document.getElementById('container'))
}

render()
structure.on('swap', render)
