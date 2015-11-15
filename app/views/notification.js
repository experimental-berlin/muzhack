'use strict'
let logger = require('js-logger-aknudsen').get('NotificationService')

module.exports = {
  warn: (title, message) => {
    modalService.showModal('messageModal', title, {message: message,})
  },
  question: (title, message, yesCallback, noCallback) => {
    modalService.showModal('questionModal', title, {message: message,}, {
      yes: yesCallback,
      no: noCallback,
    })
  },
}
