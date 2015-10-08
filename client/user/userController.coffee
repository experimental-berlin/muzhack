logger = new Logger('UserController')

@UserController = RouteController.extend({
  onRun: ->
    tabName = @params.hash
    data = @data()
    if data? and tabName == "media"
      logger.debug("Loading media data from server")
      Session.set("isWaiting", true)
      # TODO: Ensure that this gets called again when user data changes
      state = @state
      Meteor.call("getSoundCloudEmbeddables", data.username, (error, result) ->
        Session.set("isWaiting", false)
        if error?
          logger.warn("Server failed to get SoundCloud embeddables:", error)
          notificationService.warn("Error",
            "Server failed to get SoundCloud embeddables: #{error.reason}.")
        else
          logger.debug("Server was able to successfully get SoundCloud embeddables:", result)
          Session.set("soundCloudEmbeddables", result)
      )
    else
      logger.debug("Not loading media data from the server:", data, tabName)
  action: ->
    data = @data()
    # TODO: Consolidate with ProjectController
    tabName = @getParams().hash
    defaultTab = "projects"
    aboutEnabled = !S.isBlank(data.profile.about)
    mediaEnabled = !R.isEmpty(data.profile.soundCloud?.uploads || [])
    logger.debug("User has media files: #{mediaEnabled}")
    tabNames = ["projects", "plans", "about", "media"]
    if tabName not in tabNames
      tabName = defaultTab
    if (tabName == "about" && !aboutEnabled) || (tabName == "media" && !mediaEnabled)
      tabName = defaultTab
    logger.debug("Current tab name: '#{tabName}'")
    isLoggedInUser = data.username == Meteor.user()?.username
    logger.debug("Is logged in user: #{isLoggedInUser}")
    @state.set("activeTab", tabName)
    @state.set("isLoggedInUser", isLoggedInUser)
    @state.set("isAboutEnabled", aboutEnabled)
    @state.set("isMediaEnabled", mediaEnabled)
    @render("user")
  waitOn: -> [Meteor.subscribe("users"), Meteor.subscribe("projects"),
    Meteor.subscribe("trelloBoards"),]
  data: -> Meteor.users.findOne(username: @params.user)
  onBeforeAction: ->
    data = @data()
    if data?
      @next()
    else
      logger.debug("@data is not defined, rendering not found page")
      @render('userNotFound', {
        data: {username: @params.user},
      })
  onAfterAction: ->
    data = @data()
    if data?
      logger.debug("Setting SEO properties")
      SEO.set({
        title: "#{data.username} (#{data.profile.name})"
        meta: {
          description: "Profile page of user #{data.username} (#{data.profile.name})"
        }
      })
    else
      logger.debug("@data is not defined, cannot set SEO properties")
})
