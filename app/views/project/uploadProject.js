'use strict'
let logger = require('js-logger-aknudsen').get('saveProject')
let R = require('ramda')
let S = require('underscore.string.fp')

let {getParameters, getPictureDropzone, getFileDropzone,} = require('./editors')

module.exports = (project, specificCursor, cursor) => {
  let uploadFiles = () => {
    if (project.owner == null || project.projectId == null) {
      throw new Error(`project.owner and/or project.projectId are null`)
    }
    let fileMetadata = {
      owner: project.owner,
      projectId: project.projectId,
    }

    let picturesPromise
    if (!R.isEmpty(queuedPictures)) {
      let pictureDropzone = getPictureDropzone()
      picturesPromise = pictureDropzone.processFiles(queuedPictures, {
        metadata: fileMetadata,
        progressCallback: (path) => {
          logger.debug(`progressCallback for pictures invoked: '${path}'`)
          specificCursor = specificCursor.set('isWaiting', `Uploading picture ${path}...`)
        },
      })
    } else {
      picturesPromise = new Promise((resolve) => resolve([]))
    }
    return picturesPromise
      .then((uploadedPictures) => {
        logger.debug(`Finished uploading pictures - moving on to files:`, uploadedPictures)
        let filesPromise
        if (!R.isEmpty(queuedFiles)) {
          logger.debug(`Processing ${queuedFiles.length} file(s)`)
          let fileDropzone = getFileDropzone()
          filesPromise = fileDropzone.processFiles(queuedFiles, {
            metadata: fileMetadata,
            progressCallback: (path) => {
              logger.debug(`progressCallback for files invoked: '${path}'`)
              specificCursor.set('isWaiting', `Uploading file ${path}...`)
            },
          })
        } else {
          logger.debug(`No files to upload`)
          filesPromise = new Promise((resolve) => resolve([]))
        }
        return filesPromise
          .then((uploadedFiles) => {
            logger.debug(`Finished uploading files:`, uploadedFiles)
            return [uploadedPictures, uploadedFiles,]
          }, (error) => {
            logger.error(logger, `Uploading files failed: ${error}:`, error.stack)
            // notificationService.warn(`Error`, `Uploading files failed`)
          })
          .then((args) => {
            logger.debug(`Args of filesPromise`, args)
            return args
          })
      }, (error) => {
        logger.error(logger, `Uploading pictures failed: ${error}:`, error.stack)
        // notificationService.warn(`Error`, `Uploading pictures failed`)
      })

    return picturesPromise
  }

  let [title, description, instructions, tags, licenseId, username, queuedPictures,
    queuedFiles,] = getParameters(project, cursor)
  return uploadFiles()
    .then(([uploadedPictures, uploadedFiles,]) => {
      logger.info(`Saving project to server...`)
      let transformFiles = R.map(R.pick(['width', 'height', 'size', 'url', 'name', 'type',
        'fullPath',]))
      let pictureDropzone = getPictureDropzone()
      let pictureFiles = R.concat(
        transformFiles(pictureDropzone.getExistingFiles()),
        transformFiles(uploadedPictures)
      )
      let fileDropzone = getFileDropzone()
      let files = R.concat(
        transformFiles(fileDropzone.getExistingFiles()),
        transformFiles(uploadedFiles)
      )
      return {title, description, instructions, tags, licenseId, username, pictureFiles, files,}
    })
}
