logger = new Logger("browserpolicy")

Meteor.startup(->
  BrowserPolicy.content.allowImageOrigin(
    "https://s3-#{Meteor.settings.AWSRegion}.amazonaws.com")
  BrowserPolicy.content.allowImageOrigin(
    "https://*.githubusercontent.com")
  BrowserPolicy.content.allowEval()
  BrowserPolicy.framing.allowAll()
  BrowserPolicy.content.allowFrameOrigin("*.googletagmanager.com")
  logger.debug("Configured BrowserPolicy")
)
