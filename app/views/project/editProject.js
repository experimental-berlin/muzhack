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
  FilesEditor, getParameters, getPictureDropzone, getFileDropzone,} = require('./editors')
let router = require('../../router')
let ajax = require('../../ajax')

require('./editProject.styl')

let saveProject = (cursor) => {
  let editProject = cursor.cursor('editProject').toJS()
  let [title, description, instructions, tags, licenseId, username, queuedPictures,
    queuedFiles,] = getParameters(editProject.project, cursor)

  let uploadData = {
    owner: editProject.owner,
    projectId: editProject.projectId,
  }

  let uploadFiles = () => {
    let picturesPromise
    let pictureDropzone = getPictureDropzone()
    let fileDropzone = getFileDropzone()
    if (!R.isEmpty(queuedPictures)) {
      picturesPromise = pictureDropzone.processFiles(queuedPictures, uploadData)
    } else {
      picturesPromise = new Promise((resolve) => resolve([]))
    }
    picturesPromise
      .catch((error) => {
        logError(logger, `Uploading pictures failed: ${error}`)
        notificationService.warn(`Error`, `Uploading pictures failed`)
      })
    if (!R.isEmpty(queuedFiles)) {
      logger.debug(`Processing ${queuedFiles.length} file(s)`)
      filesPromise = fileDropzone.processFiles(queuedFiles, uploadData)
    } else {
      filesPromise = new Promise((resolve) => resolve([]))
    }
    filesPromise
      .catch((error) => {
        logError(logger, `Uploading files failed: ${error}`)
        notificationService.warn(`Error`, `Uploading files failed`)
      })

    return [picturesPromise, filesPromise,]
  }

  let [picturesPromise, filesPromise,] = uploadFiles()
  Promise.all([picturesPromise, filesPromise,])
    .then(([uploadedPictures, uploadedFiles,]) => {
      logger.info(`Saving project...`)
      let pictureDropzone = getPictureDropzone()
      let fileDropzone = getFileDropzone()
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
      ajax.putJson(`projects/${qualifiedProjectId}`, data).then(() => {
        logger.info(`Successfully updated project '${qualifiedProjectId}' on server`)
        router.goTo(`/u/${qualifiedProjectId}`)
      }, (error) => {
        cursor.cursor('editProject').set('isWaiting', false)
        logger.warn(`Failed to update project '${qualifiedProjectId}' on server: ${reason}`)
      })
    }
    , (error) => {
      logger.warn(`Uploading files/pictures failed: ${error}`)
      cursor.cursor('editProject').set('isWaiting', false)
    })

}

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
        value: project.licenseId,
        onChange: (event) => {
          logger.debug(`Project license selected:`, licenses[event.target.value])
          cursor.cursor(['editProject', 'project',]).set('licenseId', event.target.value)
        },
      }, R.map(([licenseId, license,]) => {
        logger.debug(`License ID: '${licenseId}'`)
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
            isWaiting: true,
          })
          try {
            saveProject(cursor)
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
                isWaiting: false,
                owner: params.owner,
                projectId: params.projectId,
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
