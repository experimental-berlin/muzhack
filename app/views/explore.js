'use strict'
let component = require('omniscient')
let immutable = require('immutable')
let S = require('underscore.string.fp')
let logger = require('js-logger-aknudsen').get('explore')
let R = require('ramda')
let h = require('react-hyperscript')
let React = require('react')
let ReactDOM = require('react-dom')
let Masonry = React.createFactory(require('react-masonry-component'))

let FocusingInput = require('./focusingInput')
let ajax = require('../ajax')
let router = require('../router')

if (__IS_BROWSER__) {
  require('./explore.styl')
}

let getQualifiedId = (project) => {
  return `${project.owner}/${project.projectId}`
}

let setSearch = (cursor, text) => {
  logger.debug(`Setting search to '${text}'`)
  cursor.cursor('explore').set('search', text)
}

let createProjectElement = (cursor, i) => {
  let project = cursor.toJS()
  let thumbnail = !R.isEmpty(project.pictures || []) ? project.pictures[0].exploreUrl :
    '/images/revox-reel-to-reel-resized.jpg'
  return h('.project-item', {
    key: i + 2,
    'data-id': getQualifiedId(project),
  }, [
    h('a', {href: `/u/${project.owner}/${project.projectId}`,}, [
      h('.project-item-header', [
        h('.project-item-title', project.title),
        h('.project-item-author', project.owner),
      ]),
      h('img.project-item-image', {src: thumbnail,}),
    ]),
  ])
}

let Results = component('Results', (cursor) => {
  let exploreCursor = cursor.cursor('explore')
  if (exploreCursor.get('isSearching')) {
    return h('p', 'Searching...')
  } else {
    let projectsCursor = exploreCursor.cursor('projects')
    logger.debug(`Got ${projectsCursor.toJS().length} search results`)
    let projectElems = projectsCursor.map(createProjectElement).toJS()
    return projectsCursor.isEmpty() ? h('p', 'No projects were found, please try again.') :
      Masonry({
        className: 'projects-container',
        options: {
          itemSelector: '.project-item',
          columnWidth: '.grid-sizer',
          gutter: '.gutter-sizer',
          percentPosition: true,
        },
      }, [h('.grid-sizer', {key: 0,}), h('.gutter-sizer', {key: 1,}),].concat(projectElems))
  }
})

let searchAsync = (cursor, query) => {
  return ajax.getJson('/api/search', {query: query || '',})
    .then((projects) => {
      logger.debug(`Searching succeeded`)
      return projects
    }, (reason) => {
      logger.warn('Searching failed:', reason)
      return []
    })
}

let performSearch = (cursor) => {
  let query = cursor.getIn([`explore`, `search`,])
  let searchString = encodeURIComponent(query.replace(' ', '+'))
  if (S.isBlank(searchString)) {
    router.goTo(`/`)
  } else {
    router.goTo(`/?q=${searchString}`)
  }
}

let SearchBox = component('SearchBox', function (cursor) {
  let searchQuery = cursor.cursor('explore').get('search')
  logger.debug(`SearchBox rendering, query: '${searchQuery}'`)
  let hasSearchQuery = !S.isBlank(searchQuery)
  return h('.search-box', [
    h('span#explore-do-search.search-icon.icon-search.muted', {
      onClick: R.partial(performSearch, [cursor,]),
    }),
    FocusingInput({
      id: 'explore-search-input',
      value: searchQuery,
      placeholder: 'Search MuzHack',
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
      projects: [
      ],
    })
  },
  loadData: (cursor, params, queryParams) => {
    logger.debug(`Loading projects`)
    let searchString = queryParams.q || ''
    return searchAsync(cursor, searchString)
      .then((projects) => {
        return {
          explore: {
            isSearching: false,
            search: searchString,
            projects,
          },
        }
      })
  },
  render: (cursor) => {
    // logger.debug(`Explore state:`, exploreCursor.toJS())
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
