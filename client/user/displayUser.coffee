logger = new Logger("displayUser")

getUserFirstName = (user) ->
  S.words(user.profile.name)[0]

isActiveTab = (tabName) ->
  Iron.controller().state.get("activeTab") == tabName

class UserTab
  constructor: (@title, @icon, @enabled=true) ->
    @name = @title.toLowerCase()
    @url = "##{@title.toLowerCase()}"

  classes: ->
    if isActiveTab(@name)
      logger.debug("#{@name} is active tab")
      classes = ["active"]
    else
      classes = []
    S.join(" ", R.concat(classes, if !@enabled then ["disabled"] else []))

Template.user.helpers({
  profileTabs: ->
    logger.debug("Getting profile tabs")
    state = Iron.controller().state
    [
      new UserTab("Projects"), new UserTab("Plans"), new UserTab("About", null,
        state.get("isAboutEnabled")),
      new UserTab("Media", null, state.get("isMediaEnabled")), new UserTab("Workshops", null,
        state.get("isWorkshopsEnabled"))
    ]
  displayProjects: -> isActiveTab("projects")
  displayPlans: -> isActiveTab("plans")
  displayAbout: -> isActiveTab("about")
  displayMedia: -> isActiveTab("media")
  displayWorkshops: -> isActiveTab("workshops")
  hasProjects: -> Projects.findOne({owner: @username})?
  projects: -> R.map(((project) -> R.merge(project, {createdStr: dateService.displayDate(
    project.created)})), Projects.find({owner: @username}))
  hasProjectPlans: -> TrelloBoards.findOne({username: @username})?
  projectPlans: -> TrelloBoards.find({username: @username})
  isLoggedInUser: ->
    user = Meteor.user()
    user?.username == @username
  email: -> @emails[0].address
  hasWebsite: -> !S.isBlank(@profile.website)
  avatar: ->
    if !S.isBlank(@profile.avatarUrl)
      logger.debug("User has an avatar URL: '#{@profile.avatarUrl}'")
      @profile.avatarUrl
    else
      logger.debug("User has no avatar URL, using Gravatar")
      email = @emails[0].address
      hash = CryptoJS.MD5(email).toString(CryptoJS.enc.Hex)
      gravatarUrl = "http://www.gravatar.com/avatar/#{hash}?d=identicon&s=230"
      gravatarUrl
  userProfileUrl: -> accountService.getUserProfileUrl(@username)
  userJoined: -> dateService.displayDateTextual(@createdAt)
  aboutUser: -> @profile.about
  hasAbout: -> !S.isBlank(@profile.about)
  userFirstName: -> getUserFirstName(@)
  userFullName: -> @profile.name
  hasSoundCloud: -> @profile.soundCloud?
  workshopsInfo: -> @profile.workshopsInfo
})
Template.user.events({
  "click #create-plan": ->
    logger.debug("Button for creating project plan clicked")
    modalService.showModal("createPlan", "Create Project Plan", {}, {
      ok: (inputValues) ->
        logger.debug("User OK-ed creating project plan", inputValues)
        invokeTrelloApi("createTrelloBoard", (error, result) ->
          if error?
            logger.warn("Server failed to create Trello board:", error)
            notificationService.warn("Error",
              "Server failed to create Trello board: #{error.reason}.")
          else
            logger.debug("Server was able to successfully create Trello board")
        , inputValues.name, inputValues.description, inputValues.organization)
      cancel: ->
        logger.debug("User canceled creating plan")
    })
  "click #add-existing-plan": ->
    logger.debug("Button for adding existing project plan clicked")
    logger.debug("Getting list of existing Trello boards")
    username = @username
    invokeTrelloApi("getExistingTrelloBoards", (error, result) ->
      if error?
        logger.warn("Server failed to get existing Trello boards", error)
        notificationService.warn("Error",
          "Server failed to fetch list of Trello boards: #{error.reason}.")
      else
        allBoardIds = R.map(((board) -> board.id), TrelloBoards.find({username: username}))
        boards = R.filter(((board) -> board.id not in allBoardIds), result)
        logger.debug("Server was able to successfully get existing Trello boards:", boards)
        modalService.showModal("addExistingPlan", "Add Existing Project Plan", {
          existingBoards: boards
        }, {
          ok: (inputValues) ->
            logger.debug("User OK-ed adding project plan", inputValues)
            invokeTrelloApi("addExistingTrelloBoard", (error, result) ->
              if error?
                logger.warn("Server failed to add existing Trello board:", error)
                notificationService.warn("Error",
                  "Server failed to add existing Trello board: #{error.reason}.")
              else
                logger.debug("Server was able to successfully add existing Trello board")
            , inputValues.boardId)
          cancel: ->
            logger.debug("User canceled adding existing plan")
        }, () ->
          select = document.getElementById("add-existing-board-select")
          value = select.options[select.selectedIndex].value
          !S.isBlank(value)
        )
    )
  "click .edit-project-plan": ->
    logger.debug("Entering edit mode for project plan '#{@name}' (ID #{@id})")
    id = @id
    modalService.showModal("editPlan", "Edit Project Plan", @, {
      ok: (inputValues) ->
        logger.debug("User OK-ed project plan edit", inputValues)
        invokeTrelloApi("editTrelloBoard", (error, result) ->
          if error?
            logger.warn("Server failed to edit Trello board:", error)
            notificationService.warn("Error",
              "Server failed to edit Trello board: #{error.reason}.")
          else
            logger.debug("Server was able to successfully edit Trello board")
        , id, inputValues.name, inputValues.description, inputValues.organization)
      cancel: ->
        logger.debug("User canceled creating plan")
    })
  "click .remove-project-plan": ->
    notificationService.question("Remove Project Plan?",
      "Are you sure you wish to remove the project plan #{@name}?",
      =>
        logger.debug("Removing project plan '#{@name}' (ID #{@id})")
        Session.set("isWaiting", true)
        Meteor.call("removeTrelloBoard", @id, (error, result) ->
          Session.set("isWaiting", false)
          if error?
            logger.warn("Server failed to remove Trello board", error)
            notificationService.warn("Error",
              "Server failed to remove Trello board: #{error.reason}.")
          else
            logger.debug("Server was able to successfully remove Trello board")
        )
      , ->
        logger.debug("User declined removing project plan")
    )
  "click .close-project-plan": ->
    notificationService.question("Remove/Close Project Plan?",
      "Are you sure you wish to remove the project plan #{@name} and close the Trello board?",
      =>
        logger.debug("Removing and closing project plan '#{@name}' (ID #{@id})")
        Session.set("isWaiting", true)
        invokeTrelloApi("closeTrelloBoard", (error, result) ->
          if error?
            logger.warn("Server failed to remove and close Trello board", error)
            notificationService.warn("Error",
              "Server failed to remove and close Trello board: #{error.reason}.")
          else
            logger.debug("Server was able to successfully remove and close Trello board")
        , @id)
    , ->
      logger.debug("User declined removing and closing project plan")
    )
})

Template.soundCloud.helpers({
  hasSoundCloudUploads: -> !R.isEmpty(@profile.soundCloud?.uploads || [])
  firstName: -> S.words(@profile.name)[0]
})
Template.soundCloud.onRendered(->
  embeddables = Session.get("soundCloudEmbeddables")
  if not Session.get("isWaiting") && embeddables?
    logger.debug("Rendering embeddables")
    parentElem = @find("#soundcloud-uploads")
    R.forEach((embeddable) ->
      logger.debug("Embedding SoundCloud upload, HTML:", embeddable.html)
      listItemElem = document.createElement("li")
      listItemElem.innerHTML = embeddable.html
      listItemElem.classList.add("soundcloud-upload")
      parentElem.appendChild(listItemElem)
    , embeddables)
  else
    logger.debug("No embeddables have been loaded")
)

invokeTrelloApi = (methodName, callback, args...) ->
  Session.set("isWaiting", true)
  Trello.authorize(Meteor.settings.public.trelloKey, {
    type: "popup"
    name: "MuzHack"
    scope: { read: true, "write": true }
    success: (token) ->
      logger.info("Trello authorization succeeded")
      if !token?
        throw new Error("Didn't get authorization token from Trello")
      logger.debug("Calling server method '#{methodName}' with args:", args)
      Meteor.call(methodName, token, args..., (error, result) ->
        Session.set("isWaiting", false)
        callback(error, result)
      )
    error: ->
      logger.warn("Trello authorization failed")
      notificationService.warn("Error", "Trello authorization failed")
      Session.set("isWaiting", false)
  })
