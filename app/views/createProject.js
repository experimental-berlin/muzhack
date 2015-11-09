'use strict'
let component = require('omniscient')
let h = require('react-hyperscript')
let R = require('ramda')
let logger = require('js-logger-aknudsen').get('createProject')
let $ = require('jquery')
let S = require('underscore.string.fp')

let licenses = require('../licenses')
let FocusingInput = require('./focusingInput')
let {nbsp,} = require('../specialChars')
let {markdownService,} = require('../markdown')
let dropzoneService = require('../dropzoneService')
let router = require('../router')
let {trimWhitespace,} = require('../stringUtils')
let {ValidationError,} = require('../errors')
let notification = require('./notification')

require('./createProject.styl')
require('./editAndCreate.styl')
require('./dropzone.scss')
require('./dropzone.styl')

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
    fileDropzone = dropzoneService.createDropzone('file-dropzone', false, null)
  },
}, () => {
  return h('div', [
    h('h2', 'Files'),
    h('#file-dropzone.dropzone'),
  ])
})

let createProject = (parameters, cursor) => {
  let [projectId, title, description, instructions, tags, license, username,
    queuedPictures, queuedFiles,] = parameters

  let uploadFiles = () => {
    let picturesPromise
    if (!R.isEmpty(queuedPictures)) {
      logger.debug(`Processing ${queuedPictures.length} picture(s)`)
      picturesPromise = pictureDropzone.processFiles(queuedPictures, {
        owner: username,
        projectId: projectId,
      })
    } else {
      picturesPromise = new Promise((resolve) => {resolve([])})
    }
    picturesPromise
      .catch((error) => {
        logger.error(`Uploading pictures failed: ${error}`)
        notification.warn('Error', 'Uploading pictures failed')
      })
    if (!R.isEmpty(queuedFiles)) {
      logger.debug(`Processing ${queuedFiles.length} file(s)`)
      filesPromise = fileDropzone.processFiles(queuedFiles, {
        owner: username,
        projectId: projectId,
      })
    } else {
      filesPromise = new Promise((resolve) => {resolve([])})
    }
    filesPromise
      .catch((error) => {
        logger.error(`Uploading files failed: ${error}`)
        notification.warn('Error', 'Uploading files failed')
      })

    return [picturesPromise, filesPromise,]
  }

  let [picturesPromise, filesPromise,] = uploadFiles()
  Promise.all([picturesPromise, filesPromise,])
    .then(([uploadedPictures, uploadedFiles,]) => {
      logger.debug('Uploading files/pictures finished successfully')
      let transformFiles = R.map(R.pick(['width', 'height', 'size', 'url', 'name', 'type',
        'fullPath',]))
      let pictureFiles = R.concat(
        transformFiles(pictureDropzone.getExistingFiles()),
        transformFiles(uploadedPictures)
      )
      let files = R.concat(
        transformFiles(fileDropzone.getExistingFiles()),
        transformFiles(uploadedFiles)
      )
      let qualifiedId = `${username}/${projectId}`
      logger.info(`Creating project with ID '${qualifiedId}', title '${title}' and tag(s)
        ${tags.join(', ')}`)
      logger.debug(`Picture files:`, pictureFiles)
      logger.debug('Files:', files)
      cursor.cursor('createProject').set('isWaiting', false)
    //   Meteor.call('createProject', projectId, title, description, instructions, tags,
    //     license, pictureFiles, files, (error) ->
    //       Session.set('isWaiting', false)
    //       logger.debug('Re-enabling create button')
    //       button.disabled = false
    //       if error?
    //         logger.error('Creating project on server failed: ${error}')
    //         notification.warn('Project Creation Failure',
    //           'Failed to create project due to error on server')
    //       else
    //         logger.info('Successfully created project')
    //         Router.go('/u/${qualifiedId}')
    //   )
    // , (err) ->
    //   logger.warn('Uploading files and/or pictures failed')
    //   Session.set('isWaiting', false)
    // )
  }, (error) => {
    logger.debug(`Creating project failed, exiting waiting state`)
    cursor.mergeDeep({
      createProject: {
        isWaiting: false,
      },
    })
  })
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

let Loading = component('Loading', () => {
  return h('div', 'Loading...')
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
