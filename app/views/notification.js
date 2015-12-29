'use strict'
let logger = require('js-logger-aknudsen').get('notification')
let h = require('react-hyperscript')

let Modal = require('./modal')

module.exports = {
  warn: (title, message, cursor) => {
    cursor.set(`showWarningDialog`, {title, message,})
  },
  question: (title, message, yesCallback, closeCallback) => {
    let content = h('div', [
      h('.modal-body-content', [
        message,
      ]),
      h('.button-group', [
        h('button.pure-button.pure-button-primary', {
          onClick: () => {
            logger.debug(`Yes button clicked`)
            yesCallback()
            closeCallback()
          },
        }, 'Yes'),
        h('button.pure-button', {
          onClick: () => {
            logger.debug(`No button clicked`)
            closeCallback()
          },
        }, 'No'),
      ]),
    ])
    let params = {title, content, closeCallback,}
    logger.debug(`Showing question modal, parameters:`, params)
    return Modal(params)
  },
}
