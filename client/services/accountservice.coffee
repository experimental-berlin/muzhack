logger = new Logger("AccountService")

class @AccountService
  constructor: ->
    Template.accountbar.events(
    )

  getUserProfileUrl: ->
    user = Meteor.user()
    "/u/#{user.username}"
