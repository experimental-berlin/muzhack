'use strict'
let isBrowser = require('../isBrowser')
let component = require('omniscient')
let immutable = require('immutable')
let S = require('underscore.string.fp')
let logger = require('js-logger-aknudsen').get('explore')
let R = require('ramda')
let h = require('react-hyperscript')

let ReactDOM
let Isotope
let $
if (isBrowser) {
  ReactDOM = require('react-dom')
  Isotope = require('isotope-layout/js/isotope.js')
  $ = require('jquery/dist/jquery.js')
}

let FocusingInput = require('./focusingInput')
let ajax = require('../client/ajax')

if (isBrowser) {
  require('./explore.styl')
}

let getQualifiedId = (project) => {
  return `${project.owner}/${project.projectId}`
}

let setSearch = (cursor, text) => {
  logger.debug(`Setting search to '${text}'`)
  cursor.cursor('explore').set('search', text)
}

let createProjectElement = (cursor) => {
  let project = cursor.toJS()
  let thumbnail = !R.isEmpty(project.pictures || []) ? project.pictures[0].url :
    '/images/revox-reel-to-reel-resized.jpg'
  return $(`<div class=\"project-item\" data-id=\"${getQualifiedId(project)}\">
    <a href=\"/u/${project.owner}/${project.projectId}\">
      <div class=\"project-item-header\">
        <div class=\"project-item-title\">${project.title}</div>
        <div class=\"project-item-author\">${project.owner}</div>
      </div>
      <img class=\"project-item-image\" src=\"${thumbnail}\" />
    </a>
  </div>`)[0]
}

let Results = component('Results', (cursor) => {
  if (cursor.get('isSearching')) {
    return h('p', 'Searching...')
  } else {
    let exploreCursor = cursor.cursor('explore')
    let projectsCursor = exploreCursor.cursor('projects')
    logger.debug('Have got search results:', projectsCursor.toJS())
    return projectsCursor.isEmpty() ? h('p', 'No projects were found, please try again.') :
      IsotopeContainer(cursor)
  }
})

let IsotopeContainer = component('IsotopeContainer', {
  componentDidMount: function () {
    logger.debug(`Isotope container did mount`)
    let projectsCursor = this.cursor.cursor(['explore', 'projects',])
    let projectElems = projectElems = projectsCursor.map(createProjectElement).toJS()
    let containerElem = this.refs.container
    logger.debug('Got Isotope container element:', containerElem)
    let iso = new Isotope(containerElem, {
      itemSelector: '.project-item',
      layoutMode: 'fitRows',
    })
    let elements = iso.getItemElements()
    iso.remove(elements)
    iso.insert(projectElems)
  },
}, () => {
   return h('#isotope-container', {ref: 'container',})
})

let searchAsync = (cursor, query) => {
  return ajax.getJson('search', {query: query || '',})
    .then((projects) => {
      logger.debug(`Searching succeeded:`, projects)
      return projects
    }, (reason) => {
      logger.warn('Searching failed:', reason)
      return []
    })
}

let performSearch = (cursor) => {
  if (cursor.get('isSearching')) {
    logger.warn(`performSearch invoked while already searching`)
    return
  }

  let setSearchResults = (cursor, results) => {
    cursor.update((state) => {
      return state.merge({
        isSearching: false,
        explore: state.get('explore').merge({
          projects: immutable.fromJS(results),
        }),
       })
     })
  }

  let exploreCursor = cursor.cursor('explore')
  let query = exploreCursor.get('search')
  logger.debug(`Performing search: '${query}'`)
  cursor = cursor.mergeDeep({
    isSearching: true,
    search: query,
  })
  return searchAsync(cursor, query)
    .then((projects) => {
      cursor = cursor.update((current) => {
        current = current.setIn(['explore', 'projects',], immutable.fromJS(projects))
        return current.set('isSearching', false)
      })
    })
}

let SearchBox = component('SearchBox', function (cursor) {
  let searchQuery = cursor.cursor('explore').get('search')
  logger.debug(`SearchBox rendering, query: '${searchQuery}'`, cursor.toJS())
  let hasSearchQuery = !S.isBlank(searchQuery)
  return h('.search-box', [
    h('span#explore-do-search.search-icon.icon-search.muted', {
      onClick: R.partial(performSearch, [cursor,]),
    }),
    FocusingInput({
      id: 'explore-search-input', value: searchQuery, placeholder: 'Search MuzHack',
      ref: 'search',
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
        logger.debug('Giving focus to search input')
        ReactDOM.findDOMNode(this.refs.search).select()
      },
    }) : null,
  ])
})

module.exports = {
  createState: () => {
    return immutable.fromJS({
      search: '',
      projects: [
      ],
    })
  },
  loadData: (cursor) => {
    if (isBrowser) {
    logger.debug(`Loading projects`)
    return searchAsync(cursor)
      .then((projects) => {
        return {
          isSearching: false,
          explore: {
            search: '',
            projects,
          },
        }
      })
    } else {
      logger.debug(`Rendering on server, simulating loading of data`)
      return {
        router: {
          isLoading: true,
        },
      }
    }
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
