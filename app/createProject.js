'use strict'
let component = require('omniscient')
let h = require('react-hyperscript')

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

module.exports.routeOptions = {
  requiresLogin: true,
  render: (cursor) => {
    return d.div({}, SearchBox(cursor.cursor('search')), Matches(cursor))
  },
}
