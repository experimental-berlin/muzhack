'use strict'
let R = require('ramda')
let Dropzone = require('dropzone/src/dropzone.coffee')
let S = require('underscore.string.fp')
let Promise = require('bluebird')

let editing = require('../editing')
let S3Uploader = require('../s3Uploader')

let monitoredDropzoneEvents = [
  'addedfile',
  'addedfiles',
  'debug',
  'error',
  'errormultiple',
  'processing',
  'processingmultiple',
  'removedfile',
  'thumbnail',
  'totaluploadprogress',
  'uploadprogress',
  'sending',
  'sendingmultiple',
  'success',
  'successmultiple',
  'canceled',
  'canceledmultiple',
  'complete',
  'completemultiple',
  'reset',
  'maxfilesexceeded',
  'maxfilesreached',
  'queuecomplete',
]
let mutatingDropzoneEvents = [
  'addedfile',
  'addedfiles',
  'removedfile',
]

let dropzoneLogger = require('js-logger-aknudsen').get('dropzone')
let logger = require('js-logger-aknudsen').get('DropzoneService')

let handleDropzoneEvent = (event, dropzone, ...args) => {
  dropzoneLogger.debug(`${event}:`, args)
}

let handleMutatingDropzoneEvent = (event, dropzone, ...args) => {
  dropzoneLogger.debug(`Mutating event occurred: ${event}`)
  editing.onChange()
}

let b64ToBlob = (b64Data, contentType, sliceSize) => {
  sliceSize = sliceSize || 512

  let byteCharacters = atob(b64Data)
  let byteArrays = []
  let offset = 0
  while (offset < byteCharacters.length) {
    let slice = byteCharacters.slice(offset, offset + sliceSize)
    let byteNumbers = R.map((i) => {
      return slice.charCodeAt(i)
    }, R.range(0, slice.length))
    let byteArray = new Uint8Array(byteNumbers)
    byteArrays.push(byteArray)
    offset += sliceSize
  }

  return new Blob(byteArrays, {type: contentType,})
}

let getFolder = (file) => {
  let path = S.wordsDelim(/\//)(file.fullPath)
  return path.length > 1 ? '/' + S.join('/', path.slice(0, -1)) : ''
}

class DropzoneService {
  createDropzone(cssId, forPictures, existingFiles) {
    let uploadFiles = (files, {metadata, progressCallback,}) => {
      let processedFiles = []
      let s3Folder = `${metadata.projectId}/files`
      if (metadata.owner == null || metadata.projectId == null) {
        throw new Error('data is missing owner/projectId')
      }

      logger.debug(`Uploading files to folder '${s3Folder}'`)

      let backupFile = (file, downloadUrl, resolve, reject, numTries=0) => {
        numTries += 1
        logger.debug(`Backing up file '${file.name}', try #${numTries}...`)
        let uploader = new S3Uploader('files', {
          folder: `${s3Folder}${getFolder(file)}`,
          isBackup: true,
        })
        uploader.send(file)
          .then(() => {
            logger.debug(`Succeeded in backing up file '${file.name}'`)
            file.url = downloadUrl
            file.status = Dropzone.SUCCESS
            processedFiles.push(file)
            if (!R.isEmpty(files)) {
              uploadOneFile(resolve, reject)
            } else {
              logger.debug('Finished uploading files:', processedFiles)
              resolve(processedFiles)
            }
          }, (error) => {
            logger.warn(`Failed to back up file '${file.name}': '${error.message}'`)
            if (numTries <= 3) {
              logger.info('Retrying backup')
              backupFile(file, downloadUrl, resolve, reject, numTries)
            } else {
              logger.warn(`Giving up backup of file since we've already tried ${numTries} times`)
              reject(error.message)
            }
          })
      }

      let realUploadFile = (file, resolve, reject, numTries) => {
        numTries += 1
        let folder = `${s3Folder}${getFolder(file)}`
        logger.debug(`Uploading file '${file.fullPath}', try #${numTries}...`)
        let uploader = new S3Uploader('files', {
          folder: folder,
        })
        uploader.send(file)
          .then((downloadUrl) => {
            backupFile(file, downloadUrl, resolve, reject)
          }, (error) => {
            logger.warn(`Failed to upload file '${file.fullPath}': '${error.message}'`)
            if (numTries <= 3) {
              logger.info('Retrying upload')
              realUploadFile(file, resolve, reject, numTries)
            } else {
              logger.warn(`Giving up since we've already tried ${numTries} times`)
              reject(error.message)
            }
          })
      }

      let uploadOneFile = (resolve, reject) => {
        let file = files.shift()
        logger.debug(`Uploading file:`, file)
        progressCallback(file.fullPath)
        realUploadFile(file, resolve, reject, 0)
      }

      logger.debug('Uploading files...', files)
      return new Promise(uploadOneFile)
        .catch((error) => {
          R.forEach((file) => {
            file.status = Dropzone.ERROR
          }, files)
          throw new Error(`Failed to upload files: ${error}`)
        })
    }

    let uploadPictures = (files, {metadata, progressCallback,}) => {
      let pictureDatas = []
      let pictures = []
      let s3Folder = `${metadata.projectId}/pictures`
      if (metadata.owner == null || metadata.projectId == null) {
        throw new Error('data is missing owner/projectId')
      }

      logger.debug(`Uploading pictures to folder '${s3Folder}'`)
      let uploader = new S3Uploader('pictures', {
        folder: s3Folder,
      })
      let backupUploader = new S3Uploader('pictures-backup', {
        folder: s3Folder,
        isBackup: true,
      })

      let processImage = (file, width, height) => {
        return new Promise((resolve, reject) => {
          let img = new Image()
          img.onload = () => {
            logger.debug(`Processing image file '${file.name}'...`)
            let canvas = document.createElement('canvas')
            let targetAspectRatio = width / height
            let sourceAspectRatio = img.width / img.height
            let targetWidth
            let targetHeight
            let horizontalOffset = 0
            let verticalOffset = 0
            if (sourceAspectRatio > targetAspectRatio) {
              logger.debug(`Will pad the image vertically`)
              let multiplier = width / img.width
              targetWidth = width
              targetHeight = multiplier * img.height
              verticalOffset = (height - targetHeight) / 2
            } else if (sourceAspectRatio < targetAspectRatio) {
              logger.debug(`Will pad the image horizontally`)
              let multiplier = height / img.height
              targetWidth = multiplier * img.width
              targetHeight = height
              horizontalOffset = (width - targetWidth) / 2
            }
            canvas.width = width
            canvas.height = height
            let ctx = canvas.getContext('2d')
            ctx.fillStyle = 'white'
            ctx.fillRect(0, 0, width, height)
            ctx.drawImage(img, 0, 0, img.width, img.height, horizontalOffset, verticalOffset,
              targetWidth, targetHeight)
            resolve(canvas.toDataURL('image/png'))
          }
          img.src = URL.createObjectURL(file)
        })
      }

      let processOnePicture = (resolve, reject) => {
        let file = files.shift()
        logger.debug(`Processing picture '${file.name}'`)
        processImage(file, 500, 409)
          .then((dataUri) => {
            let match = /^data:([^;]+);base64,(.+)$/.exec(dataUri)
            if (match == null) {
              reject(
                `processImage for file '${file.name}' returned data URI on wrong format: '${dataUri}'`
              )
            } else {
              pictureDatas.push([file, match[1], match[2],])
              if (!R.isEmpty(files)) {
                processOnePicture(resolve, reject)
              } else {
                logger.debug('Finished processing pictures successfully')
                resolve()
              }
            }
          })
      }

      let backupPicture = (blob, file, downloadUrl, resolve, reject, numTries) => {
        numTries += 1
        logger.debug(`Backing up picture '${file.name}', try #${numTries}...`)
        backupUploader.send(blob)
          .then(() => {
            file.url = downloadUrl
            file.status = Dropzone.SUCCESS
            pictures.push(file)
            if (!R.isEmpty(pictureDatas)) {
              uploadOnePicture(resolve, reject)
            } else {
              logger.debug('Finished uploading pictures, URLs:', pictures)
              resolve(pictures)
            }
          }, (error) => {
            logger.warn(`Failed to back up picture '${file.name}': '${error}'`)
            if (numTries <= 3) {
              logger.info('Retrying backup')
              backupPicture(blob, file, downloadUrl, resolve, reject, numTries)
            } else {
              logger.warn(`Giving up since we've already tried ${numTries} times`)
              reject(error.message)
            }
          })
      }

      let uploadPicture = (blob, file, type, resolve, reject, numTries) => {
        numTries += 1
        logger.debug(`Uploading picture '${file.name}', type '${type}', try #${numTries}...`)
        uploader.send(blob)
          .then((downloadUrl) => {
            backupPicture(blob, file, downloadUrl, resolve, reject, 0)
          }, (error) => {
            logger.warn(`Failed to upload picture '${file.name}': '${error}'`)
            if (numTries <= 3) {
              logger.info('Retrying upload')
              uploadPicture(blob, file, type, resolve, reject, numTries)
            } else {
              logger.warn(`Giving up since we've already tried ${numTries} times`)
              reject(error.message)
            }
          })
      }

      let uploadOnePicture = (resolve, reject) => {
        let numTries = 0
        let [file, type, b64,] = pictureDatas.shift()
        let blob = b64ToBlob(b64, type)
        blob.name = file.name
        progressCallback(file.fullPath)
        uploadPicture(blob, file, type, resolve, reject, 0)
      }

      logger.debug('Processing pictures...')
      return new Promise(processOnePicture)
        .then(() => {
          logger.debug('Uploading pictures...')
          return new Promise(uploadOnePicture)
        })
        .catch((error) => {
          R.forEach((file) => {
            file.status = Dropzone.ERROR
          }, files)
          logger.error(`Failed to upload pictures: ${error}`)
          throw new Error(`Failed to upload pictures: ${error}`)
        })
    }

    Dropzone.autoDiscover = false
    let dropzone = new Dropzone(`#${cssId}`, {
      dictDefaultMessage: `Drop ${forPictures ? 'pictures' : 'files'} here to upload`,
      addRemoveLinks: true,
      uploadFiles: forPictures ? uploadPictures : uploadFiles,
      autoProcessQueue: false,
      createImageThumbnails: forPictures,
    })
    R.forEach((event) => {
      dropzone.on(event, R.partial(handleDropzoneEvent, [event, dropzone,]))
    }, monitoredDropzoneEvents)
    R.forEach((event) => {
      dropzone.on(event, R.partial(handleMutatingDropzoneEvent, [event, dropzone,]))
    }, mutatingDropzoneEvents)
    if (!R.isEmpty(existingFiles || [])) {
      let description = forPictures ? 'picture' : 'file'
      let picker = forPictures ? (x) => {
        return R.merge(x, {name: x.url,})
      } : (x) => {
        return R.merge(x, {name: x.filename,})
      }
      let fileObjs = R.map(picker, existingFiles)
      logger.debug(`Adding files to ${description} dropzone: ${
        R.map((f) => {return f.filename}, existingFiles).join(', ')}`)
      dropzone.addExistingFiles(fileObjs)
    }

    return dropzone
  }
}

module.exports = new DropzoneService()
