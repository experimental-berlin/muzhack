'use strict'
let component = require('omniscient')
let immutable = require('immutable')
let S = require('underscore.string.fp')
let Isotope = require('isotope-layout/js/isotope.js')
let logger = require('js-logger').get('explore')
let $ = require('jquery/dist/jquery.js')
let R = require('ramda')
let h = require('react-hyperscript')
let FocusingInput = require('./focusingInput')

require('./explore.styl')

let getQualifiedId = (project) => {
  return `${project.owner}/${project.projectId}`
}

let searchTimeoutHandle = null
let setSearch = (cursor, text) => {
  cursor.cursor('explore').set('search', text)
  if (searchTimeoutHandle != null) {
    clearTimeout(searchTimeoutHandle)
    logger.debug('Clearing global timeout')
  }
  searchTimeoutHandle = setTimeout(() => {
    cursor.set('search',text)
    logger.debug('Setting global search variable:', text)
    searchTimeoutHandle = null
  }, 500)
}

let createProjectElement = (cursor) => {
  let project = cursor.toJS()
  // let thumbnail = if !R.isEmpty(project.pictures || []) then project.pictures[0].url else \
  //     '/images/revox-reel-to-reel-resized.jpg'
  let thumbnail = 'https://s3-eu-central-1.amazonaws.com/muzhack.com/u/aknudsen/bowsense/pictures/bowsense1.png'
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

let IsotopeContainer = component('IsotopeContainer', {
  componentDidMount: function () {
    let containerElem = this.refs.container
    let projectsCursor = this.cursor.cursor(['explore', 'projects',])
    let projectElems = projectElems = projectsCursor.map(createProjectElement).toJS()
    logger.debug('Got Isotope container element:', containerElem)
    new Isotope(containerElem, {
      itemSelector: '.project-item',
      layoutMode: 'fitRows',
    })
      .insert(projectElems)
  },
}, (cursor) => {
  let exploreCursor = cursor.cursor('explore')
  let projectsCursor = exploreCursor.cursor('projects')
  return projectsCursor.isEmpty() ? h('p', 'No projects were found, please try again.') :
    h('#isotope-container', {ref: 'container',})
})

let SearchBox = component('SearchBox', function (cursor) {
  let searchQuery = cursor.cursor('explore').get('search')
  let hasSearchQuery = !S.isBlank(searchQuery)
  logger.debug('Has search query:', searchQuery)
  return h('.search-box', [
    h('span#explore-do-search.search-icon.icon-search.muted'),
    FocusingInput({
      id: 'explore-search-input', value: searchQuery, placeholder: 'Search MuzHack',
      ref: 'search',
      onChange: (event) => {
        let text = event.currentTarget.value
        logger.debug(`Search global input detected`)
        setSearch(cursor, text)
      },
    }),
    hasSearchQuery ? h('span#explore-clear-search.clear-icon.icon-cross.muted', {
      onClick: () => {
        logger.debug('Clear search clicked')
        setSearch(cursor, '')
        logger.debug('Giving focus to search input')
        this.refs.search.getDOMNode().select()
      },
    }) : null,
  ])
})

module.exports = {
  createState: () => {
    return immutable.fromJS({
      search: '',
      projects: [
        {
          projectId: 'test',
          title: 'Test',
          owner: 'aknudsen',
        },
      ],
    })
  },
  render: (cursor) => {
    return h('.pure-g', [
      h('.pure-u-1', [
        h('#explore-pad', [
          SearchBox(cursor),
          IsotopeContainer(cursor),
        ]),
      ]),
    ])
  },
}
