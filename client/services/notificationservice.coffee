logger = new Logger("NotificationService")

class @NotificationService
  warn: (title, message) ->
    modalService.showModal("messageModal", title, { message: message })
  question: (title, message, yesCallback, noCallback) ->
    modalService.showModal("questionModal", title, { message: message }, {
      "yes": yesCallback
      "no": noCallback
    })
