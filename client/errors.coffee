logger = new Logger("errors")

@ValidationError = (message) ->
  this.message = message

ValidationError.prototype = Object.create(Error.prototype)

window.onerror = (message, url, line) ->
  logger.error("Uncaught exception, at #{url}:#{line}:\n#{message}")
  Meteor.call('logError', message, url, line)
