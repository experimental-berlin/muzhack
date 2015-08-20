logger = new Logger("ModalService")

class @ModalService
  # Show a Bootstrap modal based on a template that gets rendered on-the-fly
  showModal: (templateName, title, data, callbacks) ->
    inputValues = {}

    invokeCallback = (callback) ->
      callback(inputValues)

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
        elem.addEventListener("change", () ->
          logger.debug("Registering value '#{@value}' for input '#{@name}'")
          inputValues[@name] = @value
        , false)
    # After the modal is hidden, remove the DOM node
    $modal.on('hide.bs.modal', ->
      logger.debug("Modal is hidden, removing DOM node")
      $(this).remove()
    )
    logger.debug("Modal shown")
    $modal
