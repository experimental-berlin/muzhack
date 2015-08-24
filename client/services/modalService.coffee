logger = new Logger("ModalService")

class @ModalService
  # Show a Bootstrap modal based on a template that gets rendered on-the-fly
  showModal: (templateName, title, data, callbacks, checkValidCallback=null) ->
    inputValues = {}

    checkValid = () ->
      if !checkValidCallback?
        return

      okBtn = document.getElementsByClassName("modal-ok")[0]
      if checkValidCallback()
        logger.debug("Modal is confirmed to be in valid state")
        okBtn.disabled = false
      else
        logger.debug("Modal is determined to be in invalid state")
        okBtn.disabled = true

    invokeCallback = (callback) ->
      callback(inputValues)

    listenForInputChange = (elem) ->
      elem.addEventListener("change", () ->
        logger.debug("Registering value '#{@value}' for input '#{@name}'")
        inputValues[elem.name] = @value
        inputValues[@name] = @value

        checkValid()
      , false)

    html = Blaze.toHTMLWithData(Template[templateName], R.merge({title: title}, data))
    $modal = $(html)
    $modal.modal({
      callbacks: R.map((([key, value]) ->
        {"event": key, callback: R.partial(invokeCallback, value)})
      , R.toPairs(callbacks))
    })
    for elem in document.getElementsByClassName("modal-default")
      elem.focus()
    for elem in document.getElementsByClassName("modal-input")
      if elem.name?
        inputValues[elem.name] = elem.value
        listenForInputChange(elem)
    for elem in document.getElementsByClassName("modal-select")
      if elem.name?
        listenForInputChange(elem)
    # After the modal is hidden, remove the DOM node
    $modal.on('hide.bs.modal', ->
      logger.debug("Modal is hidden, removing DOM node")
      $(this).remove()
    )
    logger.debug("Modal shown")
    checkValid()
    $modal
