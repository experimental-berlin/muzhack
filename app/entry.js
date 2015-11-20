'use strict'
let component = require('omniscient')
let immstruct = require('immstruct')
let React = require('react')
let ReactDom = require('react-dom')
let router = require('./router')
let Logger = require('js-logger-aknudsen')
let R = require('ramda')

let about = require('./views/about')
let explore = require('./views/explore')
let displayProject = require('./views/project/displayProject')
let editProject = require('./views/project/editProject')
let createProject = require('./views/project/createProject')
let login = require('./views/login')
let logout = require('./views/logout')
let forgotPassword = require('./views/forgotPassword')
let userProfile = require('./views/userProfile/userProfile')
let ajax = require('./client/ajax')
let discourse = require('./discourse')

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
router.performInitial(structure.cursor())

let render = () => {
  ReactDom.render(router.Router(structure.cursor()), document.getElementById('container'))
}

render()
structure.on('swap', render)
