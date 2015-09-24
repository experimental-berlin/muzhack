logger = new Logger('app')

enableHotCodePush = -> Session.get("hotCodePushAllowed") and !Session.get("isEditingProject")

Meteor.startup(->
  # Settings are by default undefined on client
  Meteor.settings = Meteor.settings || {"public": {}}
  logger.debug("Instantiating editors")
  converter = Markdown.getSanitizingConverter()
  @descriptionEditor = new Markdown.Editor(converter, "-description")
  @instructionsEditor = new Markdown.Editor(converter, "-instructions")

  @loginService = new LoginService()
  @loginService.setupTemplate()
  @notificationService = new NotificationService()
  @modalService = new ModalService()
  @accountService = new AccountService()
  @dateService = new DateService()
  @searchService = new SearchService()
  @dropzoneService = new DropzoneService()

  SEO.config({
    title: 'MuzHack'
    meta: {
      description: "The hub for discovering and publishing music technology projects"
    }
  })

  Meteor._reload.onMigrate((reloadFunction) ->
    if !enableHotCodePush()
      logger.debug("Hot code push is disabled - deferring until later")
      Deps.autorun((c) ->
        if enableHotCodePush()
          logger.debug("Hot code push re-enabled - applying it")
          c.stop()
          reloadFunction()
      )
      [false]
    else
      logger.debug("Hot code push enabled")
      [true]
  )

  undefined
)

Template.registerHelper('appName', -> 'MuzHack')
Template.registerHelper('isLoggedIn', -> Meteor.userId()?)
