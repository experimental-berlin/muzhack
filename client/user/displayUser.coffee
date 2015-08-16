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
    [new UserTab("Projects"), new UserTab("Planned"),]
  displayProjects: -> isActiveTab("projects")
  displayPlanned: -> isActiveTab("planned")
  hasProjects: -> false
  hasPlannedProjects: -> false
})
Template.user.events({
  'click .tabs > li': ->
    Iron.controller().state.set('activeTab', @name)
    logger.debug("Set activeTab: #{@name}")
  "click #create-plan": ->
    logger.debug("Button for creating project plan clicked")
    modalService.showModal("createPlan", "Create Plan", {}, {
      ok: (inputValues) ->
        logger.debug("User OK-ed creating plan", inputValues)
        Session.set("isWaiting", true)
        Trello.setKey(Meteor.settings.public.trelloKey)
        Trello.authorize({
          type: "popup"
          name: "MuzHack"
          scope: { read: true, "write": true }
          success: ->
            Session.set("isWaiting", false)
            logger.info("Trello authorization succeeded")
            token = Trello.token()
            logger.debug("Creating Trello board:", inputValues)
          error: ->
            logger.warn("Trello authorization failed")
            Session.set("isWaiting", false)
        })
      cancel: ->
        logger.debug("User canceled creating plan")
    })
  "click #add-plan": ->
    logger.debug("Button for adding project plan clicked")
})
