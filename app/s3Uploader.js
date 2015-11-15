'use strict'
let logger = require('js-logger-aknudsen').get('S3Uploader')
let R = require('ramda')

let ajax = require('./ajax')

module.exports = class S3Uploader {
  constructor(directive, {folder, isBackup,}) {
    this.directive = directive
    this.folder = folder
    this.isBackup = isBackup
  }

  send(file) {
    logger.debug(`Sending data...`)
    logger.debug(`Getting S3 upload settings from server...`)
    let key = `${this.folder}/${file.name}`
    return ajax.getJson(`s3Settings/${this.directive}`, {key, isBackup: this.isBackup,})
      .then((s3Settings) => {
        logger.debug(`Received S3 settings from server`, s3Settings)
        let formData = new FormData()
        R.forEach(([key, value,]) => {
          formData.append(key, value)
        }, R.toPairs(s3Settings.fields))
        formData.append('file', file)

        return new Promise((resolve, reject) => {
          let request = new XMLHttpRequest()
          request.onreadystatechange = () => {
            if (request.readyState === XMLHttpRequest.DONE) {
              logger.debug('Received S3 upload response from server:', request)
              if (request.status === 200) {
                logger.debug(`S3 upload was successful:`, request.responseText)
                resolve(s3Settings.url)
              } else {
                logger.debug(`S3 upload was not successful: ${request.status}`)
                reject(request.responseText)
              }
            }
          }

          let url = `https://s3.${s3Settings.region}.amazonaws.com/${s3Settings.bucket}`
          logger.debug(`Posting to ${url}`, formData)
          request.open('POST', url, true)
          request.send(formData)
        })
      }, (error) => {
        logger.warn(`Failed to receive S3 settings from server`)
        throw new Error(`Failed to receive S3 settings from server`)
      })
  }
}
