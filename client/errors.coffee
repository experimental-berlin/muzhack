@ValidationError = (message) ->
  this.message = message

ValidationError.prototype = Object.create(Error.prototype)
