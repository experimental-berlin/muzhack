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
    '/login': login.render,
    '/account/forgotpassword': forgotPassword.render,
  }),
  libs: [
    { title: 'Backbone.js', url: 'http://documentcloud.github.io/backbone/', },
    { title: 'AngularJS', url: 'https://angularjs.org/', },
    { title: 'jQuery', url: 'http://jquery.com/', },
    { title: 'Prototype', url: 'http://www.prototypejs.org/', },
    { title: 'React', url: 'http://facebook.github.io/react/', },
    { title: 'Omniscient', url: 'https://github.com/omniscientjs/omniscient', },
    { title: 'Ember', url: 'http://emberjs.com/', },
    { title: 'Knockout.js', url: 'http://knockoutjs.com/', },
    { title: 'Dojo', url: 'http://dojotoolkit.org/', },
    { title: 'Mootools', url: 'http://mootools.net/', },
    { title: 'Underscore', url: 'http://documentcloud.github.io/underscore/', },
    { title: 'Lodash', url: 'http://lodash.com/', },
    { title: 'Moment', url: 'http://momentjs.com/', },
    { title: 'Express', url: 'http://expressjs.com/', },
    { title: 'Koa', url: 'http://koajs.com', },
  ],
})
router.perform()

let render = () => {
  ReactDom.render(router.Router(structure.cursor()), document.getElementById('container'))
}

render()
structure.on('swap', render)
