logger = new Logger('googletagmanager')

Template.googletagmanager.helpers({
  enableGoogleTagManager: ->
    if Meteor.settings.enableGoogleTagManager
      logger.debug("Enabling Google Tag Manager")
    else
      logger.debug("Not enabling Google Tag Manager")
    Meteor.settings.enableGoogleTagManager
})
