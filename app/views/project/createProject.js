'use strict'
let component = require('omniscient')
let h = require('react-hyperscript')
let R = require('ramda')
let logger = require('js-logger-aknudsen').get('createProject')
let $ = require('jquery')
let S = require('underscore.string.fp')

let licenses = require('../../licenses')
let FocusingInput = require('../focusingInput')
let {nbsp,} = require('../../specialChars')
let router = require('../../router')
let ajax = require('../../ajax')
let Loading = require('./loading')
let {DescriptionEditor, InstructionsEditor, PicturesEditor,
  FilesEditor,} = require('./editors')
let uploadProject = require('./uploadProject')
let userManagement = require('../../userManagement')

require('./createProject.styl')
require('./editAndCreate.styl')
require('../dropzone.scss')
require('../dropzone.styl')

let createProject = (cursor) => {
  let createCursor = cursor.cursor('createProject')
  let input = createCursor.toJS()
  let username = userManagement.getLoggedInUser(cursor).username
  let inputExtended = R.merge(input, {
    projectId: input.id,
    owner: username,
  })
  uploadProject(inputExtended, createCursor, cursor)
    .then(({title, description, instructions, tags, licenseId, username, pictureFiles, files,}) => {
      logger.debug(`Picture files:`, pictureFiles)
      logger.debug(`Files:`, files)
      logger.debug(`title: ${title}, description: ${description}, tags: ${S.join(`,`, tags)}`)
      let qualifiedProjectId = `${username}/${input.id}`
      let data = {
        id: input.id,
        title,
        description,
        instructions,
        tags,
        licenseId,
        pictures: pictureFiles,
        files,
      }
      logger.debug(`Creating project '${qualifiedProjectId}'...:`, data)
      cursor.cursor('createProject').set('isWaiting', 'Saving project...')
      ajax.postJson(`projects/${username}`, data)
        .then(() => {
          logger.info(`Successfully created project '${qualifiedProjectId}' on server`)
          router.goTo(`/u/${qualifiedProjectId}`)
        }, (error) => {
          cursor.cursor('createProject').set('isWaiting', false)
          logger.warn(`Failed to create project '${qualifiedProjectId}' on server: ${error}`,
            error.stack)
        })
      }, (error) => {
        logger.warn(`Uploading files/pictures failed: ${error}`, error.stack)
        cursor.cursor('createProject').set('isWaiting', false)
      })

}

let CreateProjectPad = component('CreateProjectPad', (cursor) => {
  let createCursor = cursor.cursor('createProject')
  let input = createCursor.toJS()
  return h('#create-project-pad', [
    h('.input-group', [
      FocusingInput({
        id: 'id-input', placeholder: 'Project ID',
        value: input.id,
        onChange: (event) => {
          logger.debug(`Project ID changed: '${event.target.value}'`)
          createCursor.set('id', event.target.value)
        },
      }),
    ]),
    h('.input-group', [
      h('input#title-input', {
        placeholder: 'Project title',
        value: input.title,
        onChange: (event) => {
          logger.debug(`Project title changed: '${event.target.value}'`)
          createCursor.set('title', event.target.value)
        },
      }),
    ]),
    h('.input-group', [
      h('input#tags-input', {
        placeholder: 'Project tags',
        value: input.tagsString,
        onChange: (event) => {
          logger.debug(`Project tags changed: '${event.target.value}'`)
          createCursor.set('tagsString', event.target.value)
        },
      }),
      nbsp,
      h('span.icon-tags2'),
    ]),
    h('.input-group', [
      h('select#license-select', {
        placeholder: 'License',
        value: input.licenseId,
        onChange: (event) => {
          logger.debug(`Project license changed: '${event.target.value}'`)
          createCursor.set('licenseId', event.target.value)
        },
      }, R.map(([id, license,]) => {
        return h('option', {value: id,}, license.name)
      }, R.toPairs(licenses))),
    ]),
    h('#description-editor', [
      DescriptionEditor(createCursor),
    ]),
    h('#pictures-editor', [
      PicturesEditor(createCursor),
    ]),
    h('#instructions-editor', [
      InstructionsEditor(createCursor),
    ]),
    h('#files-editor', [
      FilesEditor(createCursor),
    ]),
    h('#create-buttons.button-group', [
      h('button#create-project.pure-button.pure-button-primary', {
        onClick: () => {
          logger.debug(`Create button clicked`, createCursor)
          createCursor = createCursor.set('isWaiting', 'Creating project...')
          try {
            createProject(cursor)
          } catch (error) {
            createCursor.set('isWaiting', false)
            throw error
          }
        },
      }, 'Create'),
      h('button#cancel-create.pure-button', {
        onClick: () => {
          logger.debug(`Cancel button clicked`)
          // TODO: Ask user if there are modifications
          router.goTo('/')
        },
      }, 'Cancel'),
    ]),
  ])
})

module.exports.routeOptions = {
  requiresLogin: true,
  render: (cursor) => {
    let createCursor = cursor.cursor('createProject')
    if (!createCursor.get('isWaiting')) {
      return CreateProjectPad(cursor)
    } else {
      return Loading(createCursor)
    }
  },
  loadData: (cursor) => {
    return {
      createProject: {
        isWaiting: false,
        licenseId: 'cc-by-4.0',
      },
    }
  },
}
