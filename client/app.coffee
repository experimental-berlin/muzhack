logger = new Logger('app')

Meteor.startup(->
  logger.debug("Instantiating editors")
  @descriptionEditor = new MandrillAce('description-ace')
  @instructionsEditor = new MandrillAce('instructions-ace')
  for editor in [descriptionEditor, instructionsEditor,]
    editor.setTheme('ace/theme/monokai')
    editor.setMode('ace/mode/markdown')

  @loginService = new LoginService()
  @loginService.setupTemplate()
  @notificationService = new NotificationService()
  @accountService = new AccountService()

  SEO.config({
    title: 'MuzHack'
    meta: {
      'description': 'The hub for finding and publishing music technology projects',
    }
  })

  undefined
)

Template.registerHelper('appName', -> 'MuzHack')
Template.registerHelper('isLoggedIn', -> Meteor.userId()?)

class MenuElement
  constructor: (@name, @url) ->

  attrs: ->
    classes = ["menu-element"]
    if @isSelected()
      classes.push("pure-menu-selected")
    class:
      classes.join(" ")

  isSelected: ->
    if !Session.get("currentSection")?
      logger.warn("currentSection not defined in Session")
      false
    else
      Session.get("currentSection").toLowerCase() == @name.toLowerCase()

Template.layout.helpers(
  menuElements: ->
    [new MenuElement("Explore", "/"), new MenuElement("Create", "/create"),
      new MenuElement("About", "/about")]
)

class Accountbutton
  constructor: (icon, name) ->
    @icon = icon
    @name = name
    @klass = "enabled"

Template.accountbar.helpers({
  buttons: ->
    return [
      new Accountbutton('exit3', 'logout')
    ]
})
