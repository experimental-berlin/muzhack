'use strict'
let component = require('omniscient')
let immutable = require('immutable')
let S = require('underscore.string.fp')
let logger = require('js-logger-aknudsen').get('workshopsExplore')
let R = require('ramda')
let h = require('react-hyperscript')
let React = require('react')
let ReactDOM = require('react-dom')
let Packery = React.createFactory(require('react-packery-component')(React))

let FocusingInput = require('./focusingInput')
let ajax = require('../ajax')
let router = require('../router')
let {displayDateTextual,} = require('../datetime')
let {partitionWorkshops,} = require('./workshopsCommon')

if (__IS_BROWSER__) {
  require('./workshopsExplore.styl')
  require('purecss/build/grids-responsive.css')
}

let setSearch = (cursor, text) => {
  logger.debug(`Setting search to '${text}'`)
  cursor.cursor('workshopsExplore').set('search', text)
}

let createWorkshopLeaderElement = (cursor, i) => {
  let workshopLeader = cursor.toJS()
  let [numUpcomingWorkshops, numPastWorkshops,] = R.map(R.prop('length'),
    partitionWorkshops(workshopLeader))
  return h('li.workshop-leader-item', {
    key: i,
    'data-id': workshopLeader.id,
  }, [
    h('a', {href: `/u/${workshopLeader.id}`,}, [
      h('.pure-u-1.pure-u-md-4-24', [
        h('.workshop-leader-item-image-wrapper', [
          h('img.workshop-leader-item-image', {src: workshopLeader.avatarUrl,}),
        ]),
      ]),
      h('.pure-u-1.pure-u-md-20-24', [
        h('.workshop-leader-item-content', [
          h('.pure-u-24-24', [
            h('.workshop-leader-item-name', workshopLeader.name),
          ]),
          h('.pure-u-19-24', [
            h('p.workshop-leader-item-about', workshopLeader.blurb),
            h('.workshop-leader-item-metadata.muted.small', [
              h('.workshop-leader-item-location', workshopLeader.location),
              h('.workshop-leader-item-joined', `Joined on ${displayDateTextual(
                workshopLeader.created)}`),
            ]),
          ]),
          h('.pure-u-5-24', [
            h('.workshop-leader-item-workshops.muted', [
              // TODO
              h('.workshop-leader-item-upcoming-workshops',
                `${numUpcomingWorkshops} upcoming workshop${
                  numUpcomingWorkshops !== 1 ? 's' : ''}`),
              h('.workshop-leader-item-past-workshops',
                `${numPastWorkshops} past workshop${numPastWorkshops !== 1 ? 's': ''}`),
            ]),
          ]),
        ]),
      ]),
    ]),
  ])
}

let Results = component('Results', (cursor) => {
  let exploreCursor = cursor.cursor('workshopsExplore')
  if (exploreCursor.get('isSearching')) {
    return h('p', 'Searching...')
  } else {
    let resultsCursor = exploreCursor.cursor('searchResults')
    logger.debug(`Got ${resultsCursor.toJS().length} search results`)
    return resultsCursor.isEmpty() ? h('p', 'No workshop leaders were found, please try again.') :
      h('ul.results-container', resultsCursor.map(createWorkshopLeaderElement).toJS())
  }
})

let performSearch = (cursor) => {
  let query = cursor.getIn([`workshopsExplore`, `search`,])
  let searchString = encodeURIComponent(query.replace(' ', '+'))
  if (S.isBlank(searchString)) {
    router.goTo(`/`)
  } else {
    router.goTo(`/?q=${searchString}`)
  }
}

let SearchBox = component('SearchBox', function (cursor) {
  let searchQuery = cursor.cursor('workshopsExplore').get('search')
  logger.debug(`SearchBox rendering, query: '${searchQuery}'`)
  let hasSearchQuery = !S.isBlank(searchQuery)
  return h('.search-box', [
    h('span#explore-do-search.search-icon.icon-search.muted', {
      onClick: R.partial(performSearch, [cursor,]),
    }),
    FocusingInput({
      id: 'explore-search-input',
      value: searchQuery,
      placeholder: 'Search MuzHack Workshops',
      ref: 'search',
      refName: 'search',
      onChange: (event) => {
        let text = event.currentTarget.value
        logger.debug(`Search input detected`)
        setSearch(cursor, text)
      },
      onEnter: R.partial(performSearch, [cursor,]),
    }),
    hasSearchQuery ? h('span#explore-clear-search.clear-icon.icon-cross.muted', {
      onClick: () => {
        logger.debug('Clear search clicked')
        setSearch(cursor, '')
        let node = ReactDOM.findDOMNode(this.refs.search)
        logger.debug('Giving focus to search input:', node)
        node.select()
      },
    }) : null,
  ])
})

module.exports = {
  createState: () => {
    return immutable.fromJS({
      search: '',
      searchResults: [
      ],
    })
  },
  loadData: (cursor, params, queryParams) => {
    logger.debug(`Loading workshopLeaders`)
    let query = queryParams.q || ''
    return ajax.getJson('/api/workshops/search', {query,})
      .then((results) => {
        logger.debug(`Searching succeeded`)
        return results
      }, (reason) => {
        logger.warn('Searching failed:', reason)
        return []
      })
      .then((searchResults) => {
        return {
          workshopsExplore: {
            isSearching: false,
            search: query,
            searchResults,
          },
        }
      })
  },
  render: (cursor) => {
    return h('.pure-g', [
      h('.pure-u-1', [
        h('#explore-pad', [
          SearchBox(cursor),
          Results(cursor),
        ]),
      ]),
    ])
  },
}
