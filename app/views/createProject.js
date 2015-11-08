'use strict'
let component = require('omniscient')
let h = require('react-hyperscript')
let R = require('ramda')
let logger = require('js-logger').get('createProject')

let licenses = require('../licenses')
let FocusingInput = require('./focusingInput')
let {nbsp,} = require('../specialChars')
let {markdownService,} = require('../markdown')
let dropzoneService = require('../dropzoneService')

require('./createProject.styl')
require('./editAndCreate.styl')
require('./dropzone.styl')

let CreateDescription = component('CreateDescription', {
  componentDidMount: () => {
    logger.debug(`CreateDescription did mount`)
    markdownService.renderDescriptionEditor()
  },
}, () => {
  return h('div', [
    h('h2', 'Description'),
    h('.editor-container', [
      h('.wmd-panel', [
        h('#wmd-button-bar-description.wmd-button-bar'),
        h('textarea#wmd-input-description.wmd-input'),
        h('#wmd-preview-description.wmd-preview.wmd-panel'),
      ]),
    ]),
  ])
})

let pictureDropzone = null

let CreatePictures = component('CreatePictures', {
  componentDidMount: () => {
    logger.debug('CreatePictures did mount')
    pictureDropzone = dropzoneService.createDropzone('picture-dropzone', true, null)
  },
}, () => {
  return h('div', [
    h('h2', 'Pictures'),
    h('#picture-dropzone.dropzone'),
  ])
})

let CreateInstructions = component('CreateInstructions', {
  componentDidMount: () => {
    logger.debug(`CreateInstructions did mount`)
    markdownService.renderInstructionsEditor()
  },
}, () => {
  return h('div', [
    h('h2', 'Instructions'),
    h('.editor-container', [
      h('.wmd-panel', [
        h('#wmd-button-bar-instructions.wmd-button-bar'),
        h('textarea#wmd-input-instructions.wmd-input'),
        h('#wmd-preview-instructions.wmd-preview.wmd-panel'),
      ]),
    ]),
  ])
})

let fileDropzone = null

let CreateFiles = component('CreateFiles', {
  componentDidMount: () => {
    logger.debug('CreateFiles did mount')
    fileDropzone = dropzoneService.createDropzone('file-dropzone', true, null)
  },
}, () => {
  return h('div', [
    h('h2', 'Files'),
    h('#file-dropzone.dropzone'),
  ])
})

let CreateProjectPad = component('CreateProjectPad', () => {
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
     CreateDescription(),
   ]),
   h('#pictures-editor', [
     CreatePictures(),
   ]),
   h('#instructions-editor', [
     CreateInstructions(),
   ]),
   h('#files-editor', [
     CreateFiles(),
   ]),
   h('#create-buttons.button-group', [
     h('button#create-project.pure-button.pure-button-primary', 'Create'),
     h('button#cancel-create.pure-button', 'Cancel'),
   ]),
 ])
})

module.exports.routeOptions = {
  requiresLogin: true,
  render: (cursor) => {
    let createCursor = cursor.cursor('createProject')
    if (!createCursor.get('isWaiting')) {
      return CreateProjectPad()
    } else {
      return Loading()
    }
  },
}
