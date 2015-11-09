'use strict'
let logger = require('js-logger-aknudsen').get('S3Uploader')

let ajax = require('./ajax')

module.exports = class S3Uploader {
  constructor(directive, {folder,}) {
    this.directive = directive
    this.folder = folder
  }

  send(file) {
    logger.debug(`Sending data...`)
    logger.debug(`Getting S3 upload settings from server...`)
    let key = `${this.folder}/${file.name}`
    return ajax.getJson(`s3Settings/${this.directive}`, {key,})
      .then((s3Settings) => {
        logger.debug(`Received S3 settings from server`, s3Settings)
        let formData = new FormData()
        formData.append('bucket', s3Settings.bucket)
        formData.append('key', key)
        formData.append('AWSAccessKeyId', s3Settings.AwsAccessKey)
        // formData.append('acl', 'public')
        formData.append('policy', s3Settings.policy)
        formData.append('signature', s3Settings.signature)
        formData.append('Content-Type', file.type)
        formData.append('file', file)

        return new Promise((resolve, reject) => {
          let request = new XMLHttpRequest()
          request.onreadystatechange = () => {
            if (request.readyState === XMLHttpRequest.DONE) {
              logger.debug('Received response from server:', request)
              if (request.status === 200) {
                logger.debug(`Response was successful:`, request.responseText)
                resolve()
              } else {
                logger.debug(`Response was not successful: ${request.status}`)
                reject(request.responseText)
              }
            }
          }

          request.open('POST', s3Settings.url, true);
          request.send(formData)
        })
      }, (error) => {
        logger.warn(`Failed to receive S3 settings from server`)
        throw new Error(`Failed to receive S3 settings from server`)
      })
  }
}
