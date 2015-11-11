'use strict'
let component = require('omniscient')
let R = require('ramda')
let S = require('underscore.string.fp')
let logger = require('js-logger-aknudsen').get('editProject')
let h = require('react-hyperscript')

require('./editProject.styl')

module.exports = component('EditProject', (cursor) => {
  let projectCursor = cursor.cursor(['explore', 'currentProject',])
  let project = projectCursor.toJS()
  logger.debug(`Rendering editing of project:`, project)
  let qualifiedProjectId = `${project.owner}/${project.projectId}`
  return h('.airy-padding-sides', [
    h('h1#project-path', qualifiedProjectId),
  ])
})
