logger = new Logger("navbar")

timeoutHandle = null

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

class Accountbutton
  constructor: (icon, name, url="#") ->
    @icon = icon
    @name = name
    @klass = "enabled"
    @url = url

Template.layout.helpers(
  menuElements: ->
    [
      new MenuElement("Explore", "/"),
      new MenuElement("Create", "/create")
      new MenuElement("Forums", Meteor.settings.public.discourseUrl, newTab=true)
      new MenuElement("About", "/about")
    ]
  searchQuery: -> Session.get("navbar.searchQuery")
  hasSearchQuery: ->
    !S.isBlank(Session.get("navbar.searchQuery"))
)

Template.layout.events({
  "input #navbar-search-input": (event) ->
    Session.set("navbar.searchQuery", trimWhitespace(event.target.value))
  "keyup #navbar-search-input": (event) ->
    if event.keyCode == 13
      searchService.search(Session.get("navbar.searchQuery"))
  "click #navbar-do-search": ->
    searchService.search(Session.get("navbar.searchQuery"))
  "click #navbar-clear-search": ->
    logger.debug("Clearing search")
    Session.set("navbar.searchQuery", "")
})

Template.accountbar.helpers({
  buttons: ->
    user = Meteor.user()
    if user?
      [
        new Accountbutton('user', 'account', "/u/#{user.username}")
        new Accountbutton('exit3', 'logout', '/logout')
      ]
    else
      []
})
