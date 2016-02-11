'use strict'
let component = require('omniscient')
let R = require('ramda')
let S = require('underscore.string.fp')
let logger = require('js-logger-aknudsen').get('editProject')
let h = require('react-hyperscript')

let userManagement = require('../../userManagement')
let licenses = require('../../licenses')
let {nbsp,} = require('../../specialChars')
let ajax = require('../../ajax')
let FocusingInput = require('../focusingInput')
let {DescriptionEditor, InstructionsEditor, PicturesEditor,
  FilesEditor,} = require('./editors')
let Loading = require('./loading')
let notification = require('../notification')

let router
let uploadProject
if (__IS_BROWSER__) {
  uploadProject = require('./uploadProject')
  router = require('../../router')

  require('./editAndCreate.styl')
  require('./editProject.styl')
}

let editProject = (cursor) => {
  let editCursor = cursor.cursor('editProject')
  let editProject = editCursor.toJS()
  uploadProject(editProject.project, editCursor, cursor)
    .then(({title, description, instructions, tags, licenseId, username, pictureFiles, files,}) => {
      logger.debug(`Picture files:`, pictureFiles)
      logger.debug(`Files:`, files)
      logger.debug(`title: ${title}, description: ${description}, tags: ${S.join(`,`, tags)}`)
      let qualifiedProjectId = `${editProject.owner}/${editProject.projectId}`
      let data = {
        title,
        description,
        instructions,
        tags,
        licenseId,
        pictures: pictureFiles,
        files,
      }
      logger.debug(`Updating project '${qualifiedProjectId}'...:`, data)
      ajax.putJson(`/api/projects/${qualifiedProjectId}`, data)
        .then(() => {
          logger.info(`Successfully updated project '${qualifiedProjectId}' on server`)
          router.goTo(`/u/${qualifiedProjectId}`)
        }, (error) => {
          editCursor = editCursor.set('isWaiting', false)
          logger.warn(`Failed to update project '${qualifiedProjectId}' on server: ${reason}`)
        })
      }, (error) => {
        logger.warn(`Uploading files/pictures failed: ${error}`, error.stack)
        editCursor = editCursor.set('isWaiting', false)
      })
}

let DeleteProjectDialog = component('DeleteProjectDialog', (cursor) => {
  
  let yesCallback = () => {
    let editCursor = cursor.cursor('editProject')
    let projectCursor = editCursor.cursor('project')
    let project = projectCursor.toJS()
    let qualifiedProjectId = `${project.owner}/${project.projectId}`
    
    editCursor.set('isWaiting', true)
    
    ajax.delete(`/api/projects/${project.owner}/${project.projectId}`)
      .then(() => {
        logger.debug(`Project successfully deleted '${qualifiedProjectId}'`)
        router.goTo('/')
      }, (error) => {
        logger.warn(`Failed to delete project '${qualifiedProjectId}': ${error}`)
      })
      .finally(() => {
        cursor.set('showDeleteProjectDialog', false)
        editCursor.set('isWaiting', false)
      })
  }

  let closeCallback = () => {
    cursor.set('showDeleteProjectDialog', false)
  }
  let title = 'Delete'
  let message = 'Are you sure you want to delete this project?'

  return notification.question(title, message, yesCallback, closeCallback)
  
})

let EditProjectPad = component('EditProjectPad', (cursor) => {
  let editCursor = cursor.cursor('editProject')
  let projectCursor = editCursor.cursor('project')
  let project = projectCursor.toJS()
  let showDialog = cursor.get('showDeleteProjectDialog') === true

  return h('#edit-project-pad', [
    showDialog ? DeleteProjectDialog(cursor) : null,
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
        value: project.licenseId,
        onChange: (event) => {
          logger.debug(`Project license selected:`, licenses[event.target.value])
          cursor.cursor(['editProject', 'project',]).set('licenseId', event.target.value)
        },
      }, R.map(([licenseId, license,]) => {
        return h('option', {value: licenseId,}, license.name)
      }, R.toPairs(licenses))),
    ]),
    h('#description-editor', [
      DescriptionEditor(projectCursor),
    ]),
    h('#pictures-editor', [
      PicturesEditor(projectCursor),
    ]),
    h('#instructions-editor', [
      InstructionsEditor(projectCursor),
    ]),
    h('#files-editor', [
      FilesEditor(projectCursor),
    ]),
    h('#edit-buttons.button-group', [
      h('button#save-project.pure-button.pure-button-primary', {
        onClick: () => {
          logger.debug(`Save button clicked`)
          editCursor = editCursor.mergeDeep({
            isWaiting: 'Saving project...',
          })
          try {
            editProject(cursor)
          } catch (error) {
            editCursor.mergeDeep({
              isWaiting: false,
            })
            throw error
          }
        },
      }, 'Save'),
      h('button#cancel-edit.pure-button', {
        onClick: () => {
          logger.debug(`Cancel button clicked`)
          let project = cursor.cursor(['editProject', 'project',]).toJS()
          // TODO: Ask user if there are modifications
          router.goTo(`/u/${project.owner}/${project.projectId}`)
        },
      }, 'Cancel'),
      h('a#remove-project', {
        href: '#',
        onClick: () => {
          logger.debug(`Asked to remove project`)
          // TODO: Ask user for confirmations
          
          cursor.set('showDeleteProjectDialog', true)
        },
      }, 'Remove this project'),
    ]),
  ])
})

module.exports = {
  requiresLogin: true,
  render: (cursor) => {
    logger.debug(`Rendering`)
    let projectCursor = cursor.cursor(['editProject', 'project',])
    let project = projectCursor.toJS()
    if (!cursor.cursor('editProject').get('isWaiting')) {
      return h('div', [
        h('h1#project-path', `${project.owner} / ${project.projectId}`),
        EditProjectPad(cursor),
      ])
    } else {
      return Loading(cursor.cursor('editProject'))
    }
  },
  loadData: (cursor, params) => {
    let loggedInUser = userManagement.getLoggedInUser(cursor)
    if (loggedInUser.username !== params.owner) {
      router.goTo(`${params.owner}/${params.projectId}`)
    } else {
      logger.debug(`Loading project ${params.owner}/${params.projectId}`)
      return ajax.getJson(`/api/projects/${params.owner}/${params.projectId}`)
        .then((project) => {
          logger.debug(`Loading project JSON succeeded:`, project)
          return {
            editProject: {
              isWaiting: false,
              owner: params.owner,
              projectId: params.projectId,
              project: R.merge(project, {
                tagsString: S.join(',', project.tags),
              }),
            },
          }
        }, (error) => {
          logger.warn(`Loading project JSON failed: '${error}':`, error.stack)
        })
    }
  },
}
