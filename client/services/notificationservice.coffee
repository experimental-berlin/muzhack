class @NotificationService
  warn: (title, message) ->
    @showModal("messageModal",
      {
        title: title,
        message: message
      })

  # Show a Bootstrap modal based on a template that gets rendered on-the-fly
  showModal: (templateName, data) ->
    html = Blaze.toHTMLWithData(Template[templateName], data)
    $modal = $(html)
    $modal.modal()
    # After the modal is hidden, remove the DOM node
    $modal.on('hide.bs.modal', ->
      $(this).remove()
    )

    return $modal
