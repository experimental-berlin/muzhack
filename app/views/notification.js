'use strict'
let logger = require('js-logger-aknudsen').get('notification')
let React = require('react')
let ReactModal = React.createFactory(require('react-modal'))
let component = require('omniscient')
let h = require('react-hyperscript')

let Modal = component(() => {
  return ReactModal({
    isOpen: true,
    onRequestClose: () => {
      logger.debug(`Closing modal`)
    },
  }, h('div', [
    h('h2', 'Helluuu'),
  ]))
})

module.exports = {
  warn: (title, message) => {
    return Modal() //'messageModal', title, {message: message,})
  },
  question: (title, message, yesCallback, noCallback) => {
    return Modal() //('questionModal', title, {message: message,}, {
    //   yes: yesCallback,
    //   no: noCallback,
    // })
  },
}
