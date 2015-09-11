logger = new Logger("browserpolicy")

Meteor.startup(->
  BrowserPolicy.content.allowImageOrigin(
    "https://s3-#{Meteor.settings.AWSRegion}.amazonaws.com")
  BrowserPolicy.content.allowImageOrigin("blob:")
  BrowserPolicy.content.allowImageOrigin("https://*")
  BrowserPolicy.content.allowImageOrigin("http://*")
  BrowserPolicy.content.allowEval()
  BrowserPolicy.framing.allowAll()
  BrowserPolicy.content.allowFrameOrigin("*.googletagmanager.com")
  logger.debug("Configured BrowserPolicy")
)
