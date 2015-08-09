logger = new Logger("browserpolicy")

Meteor.startup(->
  BrowserPolicy.content.allowImageOrigin(
    "https://s3-#{Meteor.settings['AWSRegion']}.amazonaws.com")
  logger.debug("Configured image origin policy")
)
