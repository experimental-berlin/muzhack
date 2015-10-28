logger = new Logger("errors")

@ValidationError = (message) ->
  this.message = message

ValidationError.prototype = Object.create(Error.prototype)

window.onerror = (message, url, line) ->
  logger.error("Uncaught exception, at #{url}:#{line}:\n#{message}")
  Meteor.call("logException", message, url, line)

@logError = (logger, message, args...) ->
  logger.error(message, args...)
  Meteor.call("logError", message)
