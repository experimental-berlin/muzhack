'use strict'
let component = require('omniscient')
let h = require('react-hyperscript')
let logger = require('js-logger-aknudsen').get('project.editors')

let {markdownService,} = require('../../markdown')
let dropzoneService = require('../../dropzoneService')

require('./editAndCreate.styl')
require('../dropzone.scss')
require('../dropzone.styl')

let DescriptionEditor = component('DescriptionEditor', {
  componentDidMount: () => {
    logger.debug(`DescriptionEditor did mount`)
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

let InstructionsEditor = component('InstructionsEditor', {
  componentDidMount: () => {
    logger.debug(`InstructionsEditor did mount`)
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

let pictureDropzone = null

let PicturesEditor = component('PicturesEditor', {
  componentDidMount: () => {
    logger.debug('PicturesEditor did mount')
    pictureDropzone = dropzoneService.createDropzone('picture-dropzone', true, null)
  },
}, () => {
  return h('div', [
    h('h2', 'Pictures'),
    h('#picture-dropzone.dropzone'),
  ])
})

let fileDropzone = null

let FilesEditor = component('FilesEditor', {
  componentDidMount: () => {
    logger.debug('FilesEditor did mount')
    fileDropzone = dropzoneService.createDropzone('file-dropzone', false, null)
  },
}, () => {
  return h('div', [
    h('h2', 'Files'),
    h('#file-dropzone.dropzone'),
  ])
})

module.exports = {
  DescriptionEditor,
  InstructionsEditor,
  PicturesEditor,
  FilesEditor,
}
