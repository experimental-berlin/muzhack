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
let InfiniteScroll = React.createFactory(require('react-infinite-scroll')())

let FocusingInput = require('./focusingInput')
let ajax = require('../ajax')
let router = require('../router')
let Loading = require('./loading')

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
      h('.project-item-image-container', [
        h('img.project-item-image', {src: thumbnail,}),
      ]),
    ]),
  ])
}

let Results = component('Results', (cursor) => {
  let loadMoreProjects = () => {
    let exploreState = cursor.cursor('explore').toJS()
    let searchString = exploreState.search
    let currentPage = exploreState.currentSearchPage
    let perPage = 6
    logger.debug(
      `Loading more projects in response to InfiniteScroll, page: ${currentPage}...`)
    return searchAsync(cursor, searchString, currentPage, perPage)
      .then((projects) => {
        let hasMoreProjects = projects.length === perPage
        let existingProjects = exploreState.projects
        logger.debug(
          `Received results from search for page ${currentPage}: ${projects.length}`)
        logger.debug(`Has more: ${hasMoreProjects}`)
        cursor = cursor.updateIn(['explore',], (current) => {
          return current.merge({
            search: searchString,
            projects: R.concat(existingProjects, projects),
            hasMoreProjects,
            currentSearchPage: currentPage + 1,
          })
        })
      })
  }

  let exploreCursor = cursor.cursor('explore')
  if (exploreCursor.get('isSearching')) {
    return h('p', 'Searching...')
  } else {
    let projectsCursor = exploreCursor.cursor('projects')
    logger.debug(`Got ${projectsCursor.toJS().length} search results`)
    let projectElems = projectsCursor.map(createProjectElement).toJS()
    return InfiniteScroll({
      loader: Loading(),
      loadMore: loadMoreProjects,
      hasMore: exploreCursor.get('hasMoreProjects'),
      threshold: 1000,
    }, Masonry({
        className: 'projects-container',
        options: {
          itemSelector: '.project-item',
          columnWidth: '.grid-sizer',
          gutter: '.gutter-sizer',
          percentPosition: true,
        },
      }, [h('.grid-sizer', {key: 0,}), h('.gutter-sizer', {key: 1,}),].concat(projectElems))
    )
  }
})

let searchAsync = (cursor, query, page, perPage) => {
  return ajax.getJson('/api/search', {
    query: query || '',
    page,
    perPage,
  })
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
      projects: [],
      hasMoreProjects: true,
      currentSearchPage: 0,
    })
  },
  loadData: (cursor, params, queryParams) => {
    let searchString = queryParams.q || ''

    logger.debug(`loadData called`)
    return {
      explore: {
        search: searchString,
        projects: [],
        hasMoreProjects: true,
        currentSearchPage: 0,
      },
    }
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
