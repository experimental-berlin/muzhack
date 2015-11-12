'use strict'
let component = require('omniscient')
let R = require('ramda')
let logger = require('js-logger-aknudsen').get('editProject')
let h = require('react-hyperscript')

let FocusingInput = require('../focusingInput')
let Loading = require('./loading')
let licenses = require('../../licenses')
let {nbsp,} = require('../../specialChars')
let {DescriptionEditor, InstructionsEditor, PicturesEditor,
  FilesEditor,} = require('./editors')
let loadData = require('./loadData')
let router = require('../../router')

require('./editProject.styl')

let EditProjectPad = component('EditProjectPad', (cursor) => {
  let editCursor = cursor.cursor('editProject')
  return h('#edit-project-pad', [
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
    render: (cursor) => {
      logger.debug(`Rendering`)
      let projectCursor = cursor.cursor(['explore', 'currentProject',])
      let project = projectCursor.toJS()
      let qualifiedProjectId = `${project.owner}/${project.projectId}`
      if (!cursor.cursor('editProject').get('isWaiting')) {
        return EditProjectPad(cursor)
      } else {
        return Loading()
      }
    },
    loadData,
  },
}
