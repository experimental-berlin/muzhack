'use strict'
let logger = require('js-logger-aknudsen').get('notification')
let React = require('react')
let ReactModal = React.createFactory(require('react-modal'))
let component = require('omniscient')
let h = require('react-hyperscript')

require('./modal.styl')

let modalStyles = {
  overlay: {
    zIndex: 10000,
  },
  content: {
    position: 'relative',
    top: 'auto',
    left: 'auto',
    right: 'auto',
    bottom: 'auto',
    marginLeft: 'auto',
    marginRight: 'auto',
    marginTop: '30px',
    marginBottom: '30px',
    width: '600px',
    padding: 0,
  },
}

let Modal = component(({closeCallback, title, content,}) => {
  let closeModal = () => {
    logger.debug(`Closing modal`)
    closeCallback()
  }
  return ReactModal({
    isOpen: true,
    style: modalStyles,
    onRequestClose: closeModal,
  }, h('.modal', [
    h('.modal-header', [
      h('.modal-header-content', [
        h('h3', title),
        h('button.close', {
          onClick: closeModal,
        }, '×'),
      ]),
    ]),
    h('.modal-body', [
      content,
    ]),
  ]))
})

module.exports = {
  warn: (title, message) => {
    return Modal({title, cursor,})
  },
  question: (title, message, yesCallback, noCallback, closeCallback) => {
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
            noCallback()
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
