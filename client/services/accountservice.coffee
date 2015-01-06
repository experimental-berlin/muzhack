logger = new Logger("AccountService")

class @AccountService
  constructor: ->
    Template.accountbar.events(
      "click .toolbar-btn": ->
        switch @name
          when "logout"
            logger.debug("Logging user out")
            Meteor.logout()
    )