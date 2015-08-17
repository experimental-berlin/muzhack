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
  hasProjects: -> Projects.findOne({owner: @username})?
  projects: -> Projects.find({owner: @username})
  hasPlannedProjects: -> TrelloBoards.findOne({username: @username})?
  plannedProjects: -> TrelloBoards.find({username: @username})
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
            logger.info("Trello authorization succeeded")
            token = Trello.token()
            logger.debug("Creating Trello board:", inputValues)
            Meteor.call('createTrelloBoard', inputValues.name, inputValues.desc, inputValues.org,
              token, (error, result) ->
                Session.set("isWaiting", false)
                if error?
                  logger.warn("Server failed to create Trello board:", error)
                  notificationService.warn("Error",
                    "Server failed to create Trello board: #{error.reason}.")
                else
                  logger.debug("Server was able to successfully create Trello board")
            )
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
