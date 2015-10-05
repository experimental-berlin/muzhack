logger = new Logger('app')

enableHotCodePush = -> Session.get("hotCodePushAllowed") and !Session.get("isEditingProject")

isMarkdownHelpEnabled = false

onMarkdownHelp = (suffix) ->
  logger.debug("Toggling Markdown help")
  isMarkdownHelpEnabled = !isMarkdownHelpEnabled
  buttonBar = document.getElementById("wmd-button-bar-#{suffix}")
  helpId = "wmd-help-#{suffix}"
  if isMarkdownHelpEnabled
    helpElem = document.createElement("div")
    helpElem.id = helpId
    helpList = document.createElement("ul")
    helpList.style.padding = 0
    helpList.style.margin = 0
    helpElem.appendChild(helpList)
    for topic in ["Links", "Images", "Styling/Headers", "Lists", "Blockquotes", "Code", "HTML"]
      helpItem = document.createElement("li")
      helpItem.style['list-style'] = "none"
      helpItem.style.display = "inline-block"
      helpItem.style["padding-right"] = "8px"
      helpItem.appendChild(document.createTextNode(topic))
      helpList.appendChild(helpItem)
    buttonBar.appendChild(helpElem)
  else
    buttonBar.removeChild(document.getElementById(helpId))

Meteor.startup(->
  # Settings are by default undefined on client
  Meteor.settings = Meteor.settings || {"public": {}}
  logger.debug("Instantiating editors")
  converter = Markdown.getSanitizingConverter()
  markdownOptions = {
    icons: {
      bold: "bold"
      italic: "italic"
      link: "link"
      quote: "quotes-left"
      code: "code"
      image: "image2"
      olist: "list-numbered"
      ulist: "list2"
      heading: "heading"
      hr: "ruler"
      undo: "undo"
      redo: "redo"
      help: "question"
    }
    helpButton: {handler: onMarkdownHelp}
  }
  @descriptionEditor = new Markdown.Editor(converter, "-description",
    R.merge(markdownOptions, {helpButton: {handler: R.partial(onMarkdownHelp, "description")}}))
  @instructionsEditor = new Markdown.Editor(converter, "-instructions", markdownOptions,
    R.merge(markdownOptions, {helpButton: {handler: R.partial(onMarkdownHelp, "instructions")}}))

  @loginService = new LoginService()
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
