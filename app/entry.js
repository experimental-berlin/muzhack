'use strict'
let component = require('omniscient')
let immstruct = require('immstruct')
let React = require('react')
let ReactDom = require('react-dom')
let router = require('./router')
let Logger = require('js-logger')
let R = require('ramda')

let about = require('./views/about')
let explore = require('./views/explore')
let project = require('./views/project')
let createProject = require('./views/createProject')
let login = require('./views/login')
let logout = require('./views/logout')
let forgotPassword = require('./views/forgotPassword')
let userProfile = require('./views/userProfile/userProfile')

require('./app.styl')
require('./styles/fonts.css')

Logger.useDefaults()

let logger = Logger.get('entry')

let structure = immstruct('state', {
  search: '',
  login: login.createState(),
  explore: explore.createState(),
  userProfile: userProfile.createState(),
  router: router.createState({
    '/': explore.routeOptions,
    '/u/:user': userProfile.routeOptions,
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
