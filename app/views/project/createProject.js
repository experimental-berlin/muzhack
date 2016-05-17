'use strict'
let component = require('omniscient')
let h = require('react-hyperscript')
let R = require('ramda')
let logger = require('js-logger-aknudsen').get('createProject')
let S = require('underscore.string.fp')
let React = require('react')
let ReactAutoComplete = React.createFactory(require('@arve.knudsen/react-autocomplete'))

let userManagement = require('../../userManagement')
let licenses = require('../../licenses')
let FocusingInput = require('../focusingInput')
let {nbsp,} = require('../../specialChars')
let ajax = require('../../ajax')
let Loading = require('./loading')
let {DescriptionEditor, InstructionsEditor, PicturesEditor,
  FilesEditor,} = require('./editors')

let uploadProject
let router
if (__IS_BROWSER__) {
  uploadProject = require('./uploadProject')
  router = require('../../router')

  require('./editAndCreate.styl')
  require('./createProject.styl')
  require('dropzone/src/dropzone.scss')
  require('../dropzone.styl')
}

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
      ajax.postJson(`/api/projects/${username}`, data)
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

let renderCreateStandaloneProject = (cursor) => {
  let createCursor = cursor.cursor('createProject')
  let input = createCursor.toJS()
  return [
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
        type: 'text',
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
        type: 'text',
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
  ]
}

let AutoComplete = component('AutoComplete', (cursor) => {
  let showSuggestions = false
  return ReactAutoComplete({
    labelText: `Choose a repository`,
    value: '',
    items: [
      'item1',
      'item2',
    ],
    getItemValue: (item) => {
      return item
    },
    onSelect: (value, item) => {
      logger.debug(`On select`)
    },
    onChange: (event, item) => {
      logger.debug(`On change`)
    },
    renderItem: (item, isHighlighted) => {
      return h('.autocomplete-item', {
        style: '', // TODO
        key: item,
        id: item,
      }, item)
    },
  })
})

let renderCreateProjectFromGitHub = (cursor) => {
  let createCursor = cursor.cursor('createProject')
  let input = createCursor.toJS()
  return [
    h('.input-group', [
      AutoComplete(createCursor),
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
  ]
}

let CreateProjectPad = component('CreateProjectPad', (cursor) => {
  let createCursor = cursor.cursor('createProject')
  let gitHubAccessToken = createCursor.get('gitHubAccessToken')
  let shouldCreateStandalone = createCursor.get('shouldCreateStandalone')
  return h('#create-project-pad', [
    gitHubAccessToken != null ? h('.input-group', [
      h('input', {
        type: 'radio', name: 'projectType', checked: shouldCreateStandalone,
        onChange: () => {
          logger.debug(`Standalone project creation selected`)
          createCursor.set('shouldCreateStandalone', true)
        },
      }),
      nbsp,
      'Standalone',
      nbsp,
      h('input', {
        type: 'radio', name: 'projectType', checked: !shouldCreateStandalone,
        onChange: () => {
          logger.debug(`GitHub project creation selected`)
          createCursor.set('shouldCreateStandalone', false)
        },
      }),
      nbsp,
      'GitHub',
    ]) : null,
    h('#project-inputs', shouldCreateStandalone ?
      renderCreateStandaloneProject(cursor) : renderCreateProjectFromGitHub(cursor)),
    ])
})

module.exports = {
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
    let state = {
      createProject: {
        isWaiting: false,
        licenseId: 'cc-by-4.0',
        shouldCreateStandalone: true,
      },
    }

    let loggedInUser = userManagement.getLoggedInUser(cursor)
    if (loggedInUser != null) {
      logger.debug(`Loading logged in user ${loggedInUser.username}...`)
      return ajax.getJson(`/api/users/${loggedInUser.username}`)
        .then((user) => {
          logger.debug(`Loading user ${user.username} JSON succeeded:`, user)
          state = R.mergeWith(R.merge, state, {
            createProject: {
              gitHubAccessToken: user.gitHubAccessToken,
            },
          })
          return state
        }, (error) => {
          logger.warn(`Loading user ${loggedInUser.username} JSON failed:`, error)
          throw error
        })
    } else {
      return state
    }
  },
}
