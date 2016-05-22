'use strict'
let R = require('ramda')
let Dropzone = require('dropzone/src/dropzone.coffee')
let S = require('underscore.string.fp')
let Promise = require('bluebird')

let editing = require('../editing')
let GoogleCloudStorageUploader = require('../cloudStorageUploader')

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
      let cloudFolder = `${metadata.projectId}/files`
      if (metadata.owner == null || metadata.projectId == null) {
        throw new Error('data is missing owner/projectId')
      }

      logger.debug(`Uploading files to folder '${cloudFolder}'`)

      let backupFile = (file, downloadUrl, numTries=0) => {
        numTries += 1
        logger.debug(`Backing up file '${file.name}', try #${numTries}...`)
        let uploader = new GoogleCloudStorageUploader({
          folder: `${cloudFolder}${getFolder(file)}`,
          isBackup: true,
        })
        return uploader.send(file)
          .then(() => {
            logger.debug(`Succeeded in backing up file '${file.name}'`)
            file.url = downloadUrl
            file.status = Dropzone.SUCCESS
            processedFiles.push(file)
            if (!R.isEmpty(files)) {
              return uploadOneFile()
            } else {
              logger.debug('Finished uploading files:', processedFiles)
              return processedFiles
            }
          }, (error) => {
            logger.warn(`Failed to back up file '${file.name}': '${error.message}'`)
            if (numTries <= 3) {
              logger.info('Retrying backup')
              return backupFile(file, downloadUrl, numTries)
            } else {
              logger.warn(`Giving up backup of file since we've already tried ${numTries} times`)
              throw error
            }
          })
      }

      let realUploadFile = (file,  numTries) => {
        numTries += 1
        let folder = `${cloudFolder}${getFolder(file)}`
        logger.debug(`Uploading file '${file.fullPath}', try #${numTries}...`)
        let uploader = new GoogleCloudStorageUploader({
          folder: folder,
        })
        return uploader.send(file)
          .then((downloadUrl) => {
            return backupFile(file, downloadUrl)
          }, (error) => {
            logger.warn(`Failed to upload file '${file.fullPath}': '${error.message}'`)
            if (numTries <= 3) {
              logger.info('Retrying upload')
              return realUploadFile(file, numTries)
            } else {
              logger.warn(`Giving up since we've already tried ${numTries} times`)
              throw error
            }
          })
      }

      let uploadOneFile = () => {
        let file = files.shift()
        logger.debug(`Uploading file:`, file)
        progressCallback(file.fullPath)
        return realUploadFile(file, 0)
      }

      logger.debug('Uploading files...', files)
      return uploadOneFile()
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
      let cloudFolder = `${metadata.projectId}/pictures`
      if (metadata.owner == null || metadata.projectId == null) {
        throw new Error('data is missing owner/projectId')
      }

      logger.debug(`Uploading pictures to folder '${cloudFolder}'`)
      let uploader = new GoogleCloudStorageUploader({
        folder: cloudFolder,
      })
      let backupUploader = new GoogleCloudStorageUploader({
        folder: cloudFolder,
        isBackup: true,
      })

      let processImage = (file) => {
        return new Promise((resolve, reject) => {
          let maxSize = 1200
          let img = new Image()
          img.onload = () => {
            logger.debug(`Processing image file '${file.name}'...`)
            let canvas = document.createElement('canvas')
            let targetWidth
            let targetHeight
            if (img.width > maxSize || img.height > maxSize) {
              logger.debug(`Image dimensions exceed max size (${maxSize} pixels), reducing size`)
              if (img.width > img.height) {
                let multiplier = maxSize / img.width
                targetWidth = maxSize
                targetHeight = multiplier * img.height
              } else {
                let multiplier = maxSize / img.height
                targetHeight = maxSize
                targetWidth = multiplier * img.width
              }
              canvas.width = targetWidth
              canvas.height = targetHeight
            } else {
              canvas.width = img.width
              canvas.height = img.height
            }
            let ctx = canvas.getContext('2d')
            ctx.drawImage(img, 0, 0, targetWidth, targetHeight)
            resolve(canvas.toDataURL('image/png'))
          }

          img.src = URL.createObjectURL(file)
        })
      }

      let processOnePicture = () => {
        let file = files.shift()
        logger.debug(`Processing picture '${file.name}'`)
        return processImage(file)
          .then((dataUri) => {
            let match = /^data:([^;]+);base64,(.+)$/.exec(dataUri)
            if (match == null) {
              throw new Error(
                `processImage for file '${file.name}' returned data URI on wrong format: '${dataUri}'`
              )
            } else {
              pictureDatas.push([file, match[1], match[2],])
              if (!R.isEmpty(files)) {
                return processOnePicture()
              } else {
                logger.debug('Finished processing pictures successfully')
              }
            }
          })
      }

      let backupPicture = (blob, file, downloadUrl, numTries) => {
        numTries += 1
        logger.debug(`Backing up picture '${file.name}', try #${numTries}...`)
        return backupUploader.send(blob)
          .then(() => {
            file.url = downloadUrl
            file.status = Dropzone.SUCCESS
            pictures.push(file)
            if (!R.isEmpty(pictureDatas)) {
              return uploadOnePicture()
            } else {
              logger.debug('Finished uploading pictures, URLs:', pictures)
              return pictures
            }
          }, (error) => {
            logger.warn(`Failed to back up picture '${file.name}':`, error)
            if (numTries <= 3) {
              logger.info('Retrying backup')
              return backupPicture(blob, file, downloadUrl, numTries)
            } else {
              logger.warn(`Giving up since we've already tried ${numTries} times`)
              throw error
            }
          })
      }

      let uploadPicture = (blob, file, type, numTries) => {
        numTries += 1
        logger.debug(`Uploading picture '${file.name}', type '${type}', try #${numTries}...`)
        return uploader.send(blob)
          .then((downloadUrl) => {
            return backupPicture(blob, file, downloadUrl, 0)
          }, (error) => {
            logger.warn(`Failed to upload picture '${file.name}': `, error)
            if (numTries <= 3) {
              logger.info('Retrying upload')
              return uploadPicture(blob, file, type, numTries)
            } else {
              logger.warn(`Giving up since we've already tried ${numTries} times`)
              throw error
            }
          })
      }

      let uploadOnePicture = () => {
        let numTries = 0
        let [file, type, b64,] = pictureDatas.shift()
        let blob = b64ToBlob(b64, type)
        blob.name = file.name
        progressCallback(file.fullPath)
        return uploadPicture(blob, file, type, 0)
      }

      logger.debug('Processing pictures...')
      return processOnePicture()
        .then(() => {
          logger.debug('Uploading pictures...')
          return uploadOnePicture()
        })
        .catch((error) => {
          R.forEach((file) => {
            file.status = Dropzone.ERROR
          }, files)
          logger.error(`Failed to upload pictures:`, error)
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
