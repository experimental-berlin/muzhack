'use strict'
let logger = require('js-logger-aknudsen').get('GoogleCloudStorageUploader')
let R = require('ramda')

let ajax = require('./ajax')

module.exports = class GoogleCloudStorageUploader {
  constructor({folder, isBackup,}) {
    this.folder = folder
    this.isBackup = isBackup
  }

  send(file) {
    logger.debug(`Sending data...`)
    logger.debug(`Getting Cloud Storage upload settings from server...`)
    let path = `${this.folder}/${file.name}`
    return ajax.getJson(`/api/gcloudStorageSettings`,
        {path, isBackup: this.isBackup,})
      .then((gcloudSettings) => {
        logger.debug(`Received Cloud Storage settings from server`, gcloudSettings)
        return new Promise((resolve, reject) => {
          let request = new XMLHttpRequest()
          request.onreadystatechange = () => {
            if (request.readyState === XMLHttpRequest.DONE) {
              logger.debug('Received Google Cloud Storage upload response from server:', request)
              if (request.status === 200) {
                logger.debug(`Google Cloud Storage upload was successful:`, request.responseText)
                resolve(gcloudSettings.url)
              } else {
                logger.debug(`Google Cloud Storage upload was not successful: ${request.status}`)
                reject(request.responseText)
              }
            }
          }

          logger.debug(`Posting to ${gcloudSettings.signedUrl}`, file)
          request.open('PUT', gcloudSettings.signedUrl, true)
          request.setRequestHeader('content-type', 'ignore')
          request.send(file)
        })
      }, (error) => {
        logger.warn(`Failed to receive Google Cloud Storage settings from server:`, error)
        throw new Error(`Failed to receive Google Cloud Storage settings from server`)
      })
  }
}
