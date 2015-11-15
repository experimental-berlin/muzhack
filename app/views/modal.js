'use strict'
let logger = require('js-logger-aknudsen').get('modal')
let $ = require('jquery')

module.exports = {
  // Show a Bootstrap modal based on a template that gets rendered on-the-fly
  showModal: (templateName, title, data, callbacks, checkValidCallback=null) => {
    let inputValues = {}

    let checkValid = () => {
      if (checkValidCallback == null) {
        return
      }

      let okBtn = document.getElementsByClassName('modal-ok')[0]
      if (checkValidCallback()) {
        logger.debug('Modal is confirmed to be in valid state')
        okBtn.disabled = false
      } else {
        logger.debug('Modal is determined to be in invalid state')
        okBtn.disabled = true
      }
    }

    let invokeCallback = (callback) => {
      return callback(inputValues)
    }

    let listenForInputChange = (elem) => {
      elem.addEventListener('change', () => {
        logger.debug(`Registering value '${this.value}' for input '${this.name}'`)
        inputValues[elem.name] = this.value
        inputValues[this.name] = this.value

        checkValid()
      }, false)
    }

    let html = Blaze.toHTMLWithData(Template[templateName], R.merge({title: title,}, data))
    let $modal = $(html)
    $modal.modal({
      callbacks: R.map(([key, value,]) => {
        return {'event': key, callback: R.partial(invokeCallback, [value,]),}
      }, R.toPairs(callbacks)),
    })
    R.forEach((elem) => {
      elem.focus()
    }, document.getElementsByClassName('modal-default'))
    R.forEach((elem) => {
      if (elem.name != null) {
        inputValues[elem.name] = elem.value
        listenForInputChange(elem)
      }
    }, document.getElementsByClassName('modal-input'))

    R.forEach((elem) => {
      if (elem.name != null) {
        listenForInputChange(elem)
      }
    }, document.getElementsByClassName('modal-select'))

    //  After the modal is hidden, remove the DOM node
    $modal.on('hide.bs.modal', function () {
      logger.debug('Modal is hidden, removing DOM node')
      $(this).remove()
    })
    logger.debug('Modal shown')
    checkValid()
    return $modal
  },
}
