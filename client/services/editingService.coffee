logger = new Logger("EditingService")

class @EditingService
  @onChange: ->
    logger.debug("Project has changed - setting dirty state")
    Session.set("isProjectModified", true)
