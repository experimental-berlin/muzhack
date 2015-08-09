logger = new Logger("browserpolicy")

Meteor.startup(->
  BrowserPolicy.content.allowImageOrigin(
    "https://s3-#{Meteor.settings.AWSRegion}.amazonaws.com")
  BrowserPolicy.content.allowImageOrigin(
    "https://*.githubusercontent.com")
  BrowserPolicy.content.allowEval()
  logger.debug("Configured BrowserPolicy")
)
