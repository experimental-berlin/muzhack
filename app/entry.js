'use strict'
let component = require('omniscient')
let immstruct = require('immstruct')
let React = require('react')
let ReactDom = require('react-dom')
let router = require('./router')
let Logger = require('js-logger')
let R = require('ramda')

let about = require('./about')
let explore = require('./explore')
let project = require('./project')
let createProject = require('./createProject')
let login = require('./login')
let logout = require('./logout')
let forgotPassword = require('./forgotPassword')

require('./app.styl')
require('./styles/fonts.css')

Logger.useDefaults()

let logger = Logger.get('entry')

let structure = immstruct('state', {
  search: '',
  login: login.createState(),
  explore: explore.createState(),
  router: router.createState({
    '/': explore.routeOptions,
    '/u/:owner/:projectId': project.routeOptions,
    '/create': createProject.routeOptions,
    '/about': about.render,
    '/login': login.routeOptions,
    '/logout': logout.render,
    '/account/forgotpassword': forgotPassword.routeOptions,
  }),
})
router.performInitial(structure.cursor())

let render = () => {
  ReactDom.render(router.Router(structure.cursor()), document.getElementById('container'))
}

render()
structure.on('swap', render)
