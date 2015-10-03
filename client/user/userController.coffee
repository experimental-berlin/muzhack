logger = new Logger('UserController')

route2tab = {
  "user": "projects"
  "user.projects": "projects"
  "user.plans": "plans"
  "user.about": "about"
}

@UserController = RouteController.extend({
  action: ->
    data = @data()
    # TODO: Consolidate with ProjectController
    tabName = route2tab[@route.getName()]
    logger.debug("Current tab name: '#{tabName}'")
    isLoggedInUser = data.username == Meteor.user()?.username
    logger.debug("Is logged in user: #{isLoggedInUser}")
    @state.set("activeTab", tabName)
    @state.set("isLoggedInUser", isLoggedInUser)
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
