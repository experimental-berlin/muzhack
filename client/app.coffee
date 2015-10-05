logger = new Logger('app')

enableHotCodePush = -> Session.get("hotCodePushAllowed") and !Session.get("isEditingProject")

isMarkdownHelpEnabled = {
  description: false
  instructions: false
}

onMarkdownHelp = (suffix) ->
  onHelpItemClick = (topic, item) ->
    logger.debug("Help item clicked: #{topic}")
    item.classList.add("selected")
    topicHelp = document.createElement("div")
    topicHelp.id = helpId
    topicHelp.classList.add("wmd-help")
    topicHelp.appendChild(document.createTextNode("Content"))
    buttonBar.appendChild(topicHelp)

  logger.debug("Toggling Markdown help for editor with suffix '#{suffix}'")
  isMarkdownHelpEnabled[suffix] = !isMarkdownHelpEnabled[suffix]
  buttonBar = document.getElementById("wmd-button-bar-#{suffix}")
  if !buttonBar?
    throw new Error("wmd-button-bar-#{suffix}")
  helpRowId = "wmd-help-row-#{suffix}"
  helpId = "wmd-help-#{suffix}"
  if isMarkdownHelpEnabled[suffix]
    helpRow = document.createElement("div")
    helpRow.id = helpRowId
    helpRow.classList.add("wmd-help-row")
    helpList = document.createElement("ul")
    helpList.style.padding = 0
    helpList.style.margin = 0
    helpRow.appendChild(helpList)
    for topic in ["Links", "Images", "Styling/Headers", "Lists", "Blockquotes", "Code", "HTML"]
      helpItem = document.createElement("li")
      helpItem.classList.add("wmd-help-item")
      helpItem.style['list-style'] = "none"
      helpItem.style.padding = "6px"
      helpItem.style.display = "inline-block"
      helpItem.style["margin-right"] = "8px"
      helpItemLink = document.createElement("a")
      helpItemLink.setAttribute("href", "#")
      helpItemLink.classList.add("wmd-help-item-link")
      helpItemLink.style["text-decoration"] = "none"
      helpItemLink.style.color = "black"
      helpItemLink.appendChild(document.createTextNode(topic))
      helpItemLink.onclick = R.partial(onHelpItemClick, topic, helpItem)
      helpItem.appendChild(helpItemLink)
      helpList.appendChild(helpItem)
    buttonBar.appendChild(helpRow)
  else
    buttonBar.removeChild(document.getElementById(helpRowId))
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
      heading: "header"
      hr: "ruler"
      undo: "undo"
      redo: "redo"
      help: "question"
    }
  }
  @descriptionEditor = new Markdown.Editor(converter, "-description",
    R.merge(markdownOptions, {helpButton: {handler: R.partial(onMarkdownHelp, "description")}}))
  @instructionsEditor = new Markdown.Editor(converter, "-instructions",
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
