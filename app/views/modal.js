'use strict'
let logger = require('@arve.knudsen/js-logger').get('modal')
let React = require('react')
let ReactModal = React.createFactory(require('react-modal'))
let h = require('react-hyperscript')
let component = require('omniscient')

if (__IS_BROWSER__) {
  require('./modal.styl')
}

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
        h('button.close', {
          onClick: closeModal,
        }, '×'),
        h('h4.modal-label', title),
      ]),
    ]),
    h('.modal-body', [
      content,
    ]),
  ]))
})

module.exports = Modal
