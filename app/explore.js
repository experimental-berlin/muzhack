'use strict'
let component = require('omniscient')
let immutable = require('immutable')
let S = require('underscore.string.fp')
let Isotope = require('isotope-layout/js/isotope.js')
let logger = require('js-logger').get('explore')
let $ = require('jquery/dist/jquery.js')
let R = require('ramda')
var h = require('react-hyperscript')

require('./explore.styl')

let createProjectElement = (project) => {
  // let thumbnail = if !R.isEmpty(project.pictures || []) then project.pictures[0].url else \
  //     '/images/revox-reel-to-reel-resized.jpg'
  return $(`<div class=\"project-item\" data-id=\"#{getQualifiedId(project)}\">
    <a href=\"/u/${project.owner}/${project.projectId}\">
      <div class=\"project-item-header\">
        <div class=\"project-item-title\">${project.title}</div>
        <div class=\"project-item-author\">${project.owner}</div>
      </div>
      <img class=\"project-item-image\" src=\"#{thumbnail}\" />
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

module.exports = {
  createState: () => {
    return immutable.fromJS({
      projects: [
        {
          projectId: 'aknudsen/test',
          title: 'Test',
          owner: 'aknudsen',
        },
      ],
    })
  },
  render: (cursor) => {
    let searchQuery = ''
    let hasSearchQuery = !S.isBlank(searchQuery)
    return h('.pure-g', [
      h('.pure-u-1', [
        h('#explore-pad', [
          h('.search-box', [
            h('span#explore-do-search.search-icon.icon-search.muted'),
            h('input#explore-search-input', {placeholder: 'Search MuzHack', value: searchQuery,}, [
              hasSearchQuery ? h('span#explore-clear-search.clear-icon.icon-cross.muted') : null,
            ]),
          ]),
          IsotopeContainer(cursor),
        ]),
      ]),
    ])
  },
}
