logger = new Logger('googletagmanager')

Template.googletagmanager.helpers({
  enableGoogleTagManager: ->
    enable = Meteor.settings.public.enableGoogleTagManager
    if enable
      logger.debug("Enabling Google Tag Manager")
    else
      logger.debug("Not enabling Google Tag Manager")
    enable
})
