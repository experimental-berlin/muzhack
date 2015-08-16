logger = new Logger("displayUser")

getActiveTab = ->
  Iron.controller().state.get("activeTab")

isActiveTab = (tabName) ->
  getActiveTab() == tabName

class UserTab
  constructor: (@title, @icon) ->
    @name = @title.toLowerCase()

  classes: ->
    if isActiveTab(@name)
      logger.debug("#{@name} is active tab")
      "active"
    else
      ""

Template.user.helpers({
  profileTabs: ->
    logger.debug("Getting profile tabs")
    tabs = [new UserTab("Projects")]
    if Iron.controller().state.get("isLoggedInUser")
      logger.debug("Displayed user is the logged in one")
      return R.concat(tabs, [new UserTab("Planned")])
    else
      logger.debug("Displayed user is not the logged in one")
      tabs
  displayProjects: -> isActiveTab("projects")
  displayPlanned: -> isActiveTab("planned")
  hasProjects: -> false
  hasPlannedProjects: -> false
})
Template.user.events({
  'click .tabs > li': ->
    Iron.controller().state.set('activeTab', @name)
    logger.debug("Set activeTab: #{@name}")
})
