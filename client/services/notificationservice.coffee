logger = new Logger("NotificationService")

class @NotificationService
  warn: (title, message) ->
    @_showModal("messageModal",
      {
        title: title,
        message: message
      })
  question: (title, message, yesCallback, noCallback) ->
    @_showModal("questionModal",
      {
        title: title,
        message: message,
      }, [
        {
          event: 'yes',
          callback: yesCallback,
        },
        {
          event: 'no',
          callback: noCallback,
        },
      ])

  # Show a Bootstrap modal based on a template that gets rendered on-the-fly
  _showModal: (templateName, data, callbacks) ->
    html = Blaze.toHTMLWithData(Template[templateName], data)
    $modal = $(html)
    $modal.modal({
      callbacks: callbacks,
    })
    # After the modal is hidden, remove the DOM node
    $modal.on('hide.bs.modal', ->
      $(this).remove()
    )
    logger.debug("Modal shown")

    return $modal
