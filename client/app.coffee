logger = new Logger('app')

enableHotCodePush = -> Session.get("hotCodePushAllowed") and !Session.get("isEditingProject")

Meteor.startup(->
  # Settings are by default undefined on client
  Meteor.settings = Meteor.settings || {"public": {}}
  logger.debug("Instantiating editors")
  @descriptionEditor = new MandrillAce('description-ace')
  @instructionsEditor = new MandrillAce('instructions-ace')
  for editor in [descriptionEditor, instructionsEditor,]
    editor.setMode('ace/mode/markdown')

  @loginService = new LoginService()
  @loginService.setupTemplate()
  @notificationService = new NotificationService()
  @accountService = new AccountService()

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

class MenuElement
  constructor: (@name, @url, @newTab=false) ->

  attrs: ->
    classes = ["menu-element"]
    if @isSelected()
      classes.push("pure-menu-selected")
    {
      class: classes.join(" ")
    }

  linkAttrs: ->
    attrs = {}
    if @newTab
      attrs.target = "_blank"
    attrs

  isSelected: ->
    if !Session.get("currentSection")?
      logger.debug("currentSection not defined in Session")
      false
    else
      Session.get("currentSection").toLowerCase() == @name.toLowerCase()

Template.layout.helpers(
  menuElements: ->
    [
      new MenuElement("Explore", "/"),
      new MenuElement("Create", "/create")
      new MenuElement("Forums", Meteor.settings.public.discourseUrl, newTab=true)
      new MenuElement("About", "/about")
    ]
)

class Accountbutton
  constructor: (icon, name, url="#") ->
    @icon = icon
    @name = name
    @klass = "enabled"
    @url = url

Template.accountbar.helpers({
  buttons: ->
    return [
      new Accountbutton('exit3', 'logout', '/logout')
    ]
})
