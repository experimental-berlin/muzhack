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
let {markdownService,} = require('../../markdown')
let dropzoneService = require('../../dropzoneService')
let router = require('../../router')
let {trimWhitespace,} = require('../../stringUtils')
let {ValidationError,} = require('../../errors')
let notification = require('../notification')
let ajax = require('../../ajax')
let Loading = require('./loading')
let {DescriptionEditor, InstructionsEditor, PicturesEditor,
  FilesEditor,} = require('./editors')

require('./createProject.styl')
require('./editAndCreate.styl')
require('../dropzone.scss')
require('../dropzone.styl')

let getParameters = (cursor) => {
  let projectId = trimWhitespace($('#id-input').val())
  let title = trimWhitespace($('#title-input').val())
  let description = markdownService.getDescription()
  logger.debug(`Description:`, description)
  let instructions = markdownService.getInstructions()
  let tags = R.map(trimWhitespace, S.wordsDelim(/,/, $('#tags-input').val()))
  let user = cursor.get('loggedInUser')
  let username = user.username
  let licenseSelect = document.getElementById('license-select')
  let license = licenseSelect.options[licenseSelect.selectedIndex].value
  if (S.isBlank(projectId) || S.isBlank(title) || R.isEmpty(tags)) {
    throw new ValidationError('Fields not correctly filled in')
  }
  if (S.isBlank(description)) {
    throw new ValidationError('Description must be filled in')
  }
  if (S.isBlank(instructions)) {
    throw new ValidationError('Instructions must be filled in')
  }
  let allPictures = pictureDropzone.getAcceptedFiles()
  if (R.isEmpty(allPictures)) {
    throw new ValidationError('There must be at least one picture')
  }
  let queuedPictures = pictureDropzone.getQueuedFiles()
  let queuedFiles = fileDropzone.getQueuedFiles()
  return [projectId, title, description, instructions, tags, license, username, queuedPictures,
    queuedFiles,]
}

let CreateProjectPad = component('CreateProjectPad', (cursor) => {
  let createCursor = cursor.cursor('createProject')
  return h('#create-project-pad', [
    h('.input-group', [
      FocusingInput({id: 'id-input', placeholder: 'Project ID',}),
    ]),
    h('.input-group', [
      h('input#title-input', {placeholder: 'Project title',}),
    ]),
    h('.input-group', [
      h('input#tags-input', {placeholder: 'Project tags',}),
      nbsp,
      h('span.icon-tags2'),
    ]),
    h('.input-group', [
      h('select#license-select', {placeholder: 'License',}, R.map(([id, license,]) => {
        return h('option', {value: id,}, license.name)
      }, R.toPairs(licenses))),
    ]),
    h('#description-editor', [
      DescriptionEditor(),
    ]),
    h('#pictures-editor', [
      PicturesEditor(),
    ]),
    h('#instructions-editor', [
      InstructionsEditor(),
    ]),
    h('#files-editor', [
      FilesEditor(),
    ]),
    h('#create-buttons.button-group', [
      h('button#create-project.pure-button.pure-button-primary', {
        disabled: !!createCursor.get('disableButtons'),
        onClick: () => {
          logger.debug(`Create button clicked`)
          createCursor = createCursor.set('disableButtons', true)
          let parameters
          try {
            parameters = getParameters(cursor)
          } catch (err) {
            createCursor.set('disableButtons', false)
            throw err
          }
          createCursor = createCursor.mergeDeep({
            isWaiting: true,
          })
          try {
            createProject(parameters, cursor)
          } catch (error) {
            createCursor.mergeDeep({
              disableButtons: false,
              isWaiting: false,
            })
            throw error
          }
        },
      }, 'Create'),
      h('button#cancel-create.pure-button', {
        disabled: !!createCursor.get('disableButtons'),
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
      return Loading()
    }
  },
}
