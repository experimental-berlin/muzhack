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
  componentDidMount: function () {
    logger.debug(`DescriptionEditor did mount`)
    markdownService.renderDescriptionEditor(this.cursor.get('description'))
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
  componentDidMount: function () {
    logger.debug(`InstructionsEditor did mount`)
    markdownService.renderInstructionsEditor(this.cursor.get('instructions'))
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
  componentDidMount: function () {
    let pictures = this.cursor.cursor('pictures').toJS()
    logger.debug('PicturesEditor did mount, pictures:', pictures)
    pictureDropzone = dropzoneService.createDropzone('picture-dropzone', true, pictures)
  },
}, () => {
  return h('div', [
    h('h2', 'Pictures'),
    h('#picture-dropzone.dropzone'),
  ])
})

let fileDropzone = null

let FilesEditor = component('FilesEditor', {
  componentDidMount: function () {
    let files = this.cursor.cursor('files').toArray()
    logger.debug('FilesEditor did mount, files:', files)
    fileDropzone = dropzoneService.createDropzone('file-dropzone', false, files)
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
