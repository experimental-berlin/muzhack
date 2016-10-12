'use strict'
let immstruct = require('immstruct')
let ReactDom = require('react-dom')
let router = require('./router')
let Logger = require('@arve.knudsen/js-logger')

let ajax = require('./ajax')
let routeMap = require('./routeMap')

require('./styles/fonts.css')

Logger.useDefaults({
  formatter: (messages, context) => {
    messages.unshift(`${context.level.name} - [${context.name}]`)
  },
})
Logger.setHandler((messages, context) => {
  if (context.level === Logger.ERROR) {
    ajax.postJson('/api/logError', {
      error: messages[0],
    })
  }

  Logger.getDefaultHandler()(messages, context)
})

let logger = Logger.get('entry')

window.onerror = (message, url, line) => {
  // TODO: Show dialog?
  logger.error(`Uncaught exception, at ${url}:${line}:\n${message}`)
}

let initialState = JSON.parse(document.getElementById('initial-state').getAttribute('data-json'))
logger.debug(`Initial state as rendered by server:`, initialState)
Stripe.setPublishableKey(initialState.stripeKey)
let structure = immstruct('state', initialState)
router.performInitial(structure.cursor(), routeMap)

let render = () => {
  ReactDom.render(router.Router(structure.cursor()), document.getElementById('container'))
}

render()
structure.on('swap', render)
