'use strict'
let component = require('omniscient')
let immstruct = require('immstruct')
let React = require('react')
let d = React.DOM
let ReactDom = require('react-dom')
let router = require('./router')
let Logger = require('js-logger')

require('./styles/about.styl')
require('./styles/fonts.css')

Logger.useDefaults()

let logger = Logger.get('entry')

let Match = component('Match', function (cursor) {
  return d.li({}, d.a({ href: cursor.get('url'), }, cursor.get('title')))
})

let Matches = component('Matches', function (cursor) {
  let q = cursor.get('search')
  let libs = cursor.get('libs')
  let matches = libs.filter((lib) => {
    return lib.get('title').indexOf(q) !== -1 || lib.get('url').indexOf(q) !== -1
  })
  return d.ul({}, matches.toArray().map((lib, i) => {
    // Add key through first argument
    return Match(`match-${lib.get('title')}`, lib)
  }))
})

let SearchBox = component('SearchBox', function (cursor) {
  return d.div({}, d.input({
    placeholder: 'Search...',
    value: cursor.deref(),
    onChange: function (e) {
      cursor.update(() => {
        return e.currentTarget.value
      })
    },
  }))
})

let structure = immstruct('state', {
  search: '',
  router: router.createState({
    '/': (cursor) => {
      return d.div({}, SearchBox(cursor.cursor('search')), Matches(cursor))
    },
    '/create': (cursor) => {
      return d.div({}, SearchBox(cursor.cursor('search')), Matches(cursor))
    },
    '/about': (cursor) => {
      return d.div({}, SearchBox(cursor.cursor('search')), Matches(cursor))
    },
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

let render = () => {
  ReactDom.render(router.Router(structure.cursor()), document.getElementById('container'))
}

render()
structure.on('swap', render)
