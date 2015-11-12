'use strict'
let component = require('omniscient')
let R = require('ramda')
let S = require('underscore.string.fp')
let logger = require('js-logger-aknudsen').get('editProject')
let h = require('react-hyperscript')

let FocusingInput = require('../focusingInput')
let Loading = require('./loading')
let licenses = require('../../licenses')
let {nbsp,} = require('../../specialChars')
let {DescriptionEditor, InstructionsEditor, PicturesEditor,
  FilesEditor,} = require('./editors')
let router = require('../../router')
let ajax = require('../../ajax')
let {trimWhitespace,} = require('../../stringUtils')

require('./editProject.styl')

let EditProjectPad = component('EditProjectPad', (cursor) => {
  let editCursor = cursor.cursor('editProject')
  let projectCursor = editCursor.cursor('project')
  let project = projectCursor.toJS()
  return h('#edit-project-pad', [
    h('.input-group', [
      h('input#title-input', {
        placeholder: 'Project title', value: project.title,
        onChange: (event) => {
          logger.debug(`Project title changed:`, event.target.value)
          projectCursor = projectCursor.set('title', event.target.value)
          logger.debug(`Project state after:`, projectCursor.toJS())
        },
      }),
    ]),
    h('.input-group', [
      h('input#tags-input', {
        placeholder: 'Project tags', value: project.tagsString,
        onChange: (event) => {
          logger.debug(`Project tags changed:`, event.target.value)
          projectCursor.set('tagsString', event.target.value)
        },
      }),
      nbsp,
      h('span.icon-tags2'),
    ]),
    h('.input-group', [
      h('select#license-select', {
        placeholder: 'License',
        value: project.license.id,
        onChange: (event) => {
          logger.debug(`Project license selected:`, event.target.value)
        },
      }, R.map((license) => {
        return h('option', {value: license.id,}, license.name)
      }, R.values(licenses))),
    ]),
    h('#description-editor', [
      DescriptionEditor(projectCursor),
    ]),
    h('#pictures-editor', [
      PicturesEditor(),
    ]),
    h('#instructions-editor', [
      InstructionsEditor(projectCursor),
    ]),
    h('#files-editor', [
      FilesEditor(),
    ]),
    h('#create-buttons.button-group', [
      h('button#create-project.pure-button.pure-button-primary', {
        disabled: !!editCursor.get('disableButtons'),
        onClick: () => {
          logger.debug(`Create button clicked`)
          editCursor = editCursor.set('disableButtons', true)
          let parameters
          try {
            parameters = getParameters(cursor)
          } catch (err) {
            editCursor.set('disableButtons', false)
            throw err
          }
          editCursor = editCursor.mergeDeep({
            isWaiting: true,
          })
          try {
            createProject(parameters, cursor)
          } catch (error) {
            editCursor.mergeDeep({
              disableButtons: false,
              isWaiting: false,
            })
            throw error
          }
        },
      }, 'Create'),
      h('button#cancel-create.pure-button', {
        disabled: !!editCursor.get('disableButtons'),
        onClick: () => {
          logger.debug(`Cancel button clicked`)
          let project = cursor.cursor(['explore', 'currentProject',]).toJS()
          // TODO: Ask user if there are modifications
          router.goTo(`/u/${project.owner}/${project.projectId}`)
        },
      }, 'Cancel'),
    ]),
  ])
})

module.exports = {
  routeOptions: {
    requiresLogin: true,
    render: (cursor) => {
      logger.debug(`Rendering`)
      let projectCursor = cursor.cursor(['editProject', 'project',])
      let project = projectCursor.toJS()
      let qualifiedProjectId = `${project.owner}/${project.projectId}`
      if (!cursor.cursor('editProject').get('isWaiting')) {
        return EditProjectPad(cursor)
      } else {
        return Loading()
      }
    },
    loadData: (cursor, params) => {
      let loggedInUser = cursor.get('loggedInUser')
      if (loggedInUser.username !== params.owner) {
        router.goTo(`${params.owner}/${params.projectId}`)
      } else {
        logger.debug(`Loading project ${params.owner}/${params.projectId}`)
        return ajax.getJson(`projects/${params.owner}/${params.projectId}`)
          .then((project) => {
            logger.debug(`Loading project JSON succeeded:`, project)
            return {
              editProject: {
                project: R.merge(project, {
                  tagsString: S.join(',', project.tags),
                }),
              },
            }
          }, (reason) => {
            logger.warn(`Loading project JSON failed: '${reason}'`)
          })
        }
      },
  },
}
