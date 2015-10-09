logger = new Logger("AccountService")

class @AccountService
  constructor: ->
    Template.accountbar.events(
    )

  getUserProfileUrl: (username) ->
    "/u/#{username}"
