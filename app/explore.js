'use strict'
let d = require('react').DOM
let component = require('omniscient')
let immutable = require('immutable')
let S = require('underscore.string.fp')
let isotope = require('isotope-layout/js/isotope.js')

require('./explore.styl')

let IsotopeContainer = component('IsotopeContainer', (cursor) => {
  let exploreCursor = cursor.cursor('explore')
  let projectsCursor = exploreCursor.cursor('projects')
  return projectsCursor.isEmpty() ? d.p({}, 'No projects were found, please try again.') :
    d.div({id: 'isotope-container',})
})

module.exports = {
  createState: () => {
    return immutable.fromJS({
      projects: [
        {
          id: 'aknudsen/test',
        },
      ],
    })
  },
  render: (cursor) => {
    let searchQuery = ''
    let hasSearchQuery = !S.isBlank(searchQuery)
    return d.div({className: 'pure-g',},
      d.div({className: 'pure-u-1',},
        d.div({id: 'explore-pad',},
          d.div({className: 'search-box',},
            d.span({id: 'explore-do-search', className: 'search-icon icon-search muted',}),
            d.input({id: 'explore-search-input', placeholder: 'Search MuzHack',
              value: searchQuery,}),
            hasSearchQuery ? d.span({id: 'explore-clear-search',
              className: 'clear-icon icon-cross muted',}) : null
          ),
          IsotopeContainer(cursor)
        )
      )
    )
  },
}
