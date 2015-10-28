logger = new Logger('routing')

Router.configure(
  layoutTemplate: 'layout'
  loadingTemplate: 'loading'
  trackPageView: true
)
Router.route('/login', ->
  logger.debug("Handling login route")
  # Make sure we don't hold on to previous user's token
  logger.debug("Logging out of Trello")
  Trello.deauthorize()
  @render('login')
, {
  onBeforeAction: ->
    if Meteor.userId()?
      logger.debug("User is already logged in - redirecting to home")
      @redirect('/')
    else
      @next()
,
  }
)
Router.route('/logout', ->
  logger.debug('Logging out')
  # Meteor.call('logOutOfDiscourse', () ->)
  Meteor.logout()
  @redirect('/')
)
Router.route('/', ->
  Session.set("searchQuery", @params.query.query)
  Session.set("explore.searchQuery", @params.query.query)
  @render('explore')
, {
  name: 'home'
  waitOn: -> Meteor.subscribe("filteredProjects", Session.get("searchQuery"))
})
Router.route('/account/forgotpassword', ->
  @render('forgotPassword')
, {
  name: 'forgotPassword',
  onBeforeAction: ->
    if Meteor.userId()?
      @redirect('/')
    else
      @next()
,
  }
)
Router.route('/about', ->
  @render('about')
)
Router.route('/create', ->
  @render('create')
)
Router.route("/u/:user", {
  name: "user"
  controller: UserController
})
Router.route('/u/:owner/:project',
  name: "project"
  controller: ProjectController
)
Router.route("/discourse/sso", ->
  renderError = (error) =>
    @render("discourseSsoError", {data: {reason: error}})

  logger.debug("Handling Discourse SSO request")

  q = @params.query
  if S.isBlank(q.sso) or S.isBlank(q.sig)
    renderError("Bad parameters from Discourse SSO request")
  else
    payload = decodeURIComponent(q.sso)
    sig = decodeURIComponent(q.sig)
    discourseUrl = Meteor.settings.public.discourseUrl
    if !discourseUrl?
      logError(logger, "Discourse URL not defined in settings")
      renderError("Internal error")
    else
      logger.debug("Calling server to verify Discourse SSO parameters")
      Meteor.call("verifyDiscourseSso", payload, sig, (error, result) ->
        if error?
          logError(logger, "Server failed to verify Discourse call: #{error.reason}")
          renderError(error.reason)
        else
          logger.info(
            "Server successfully verified Discourse call - redirecting to '#{discourseUrl}'")
          [respPayload, respSig] = result
          window.location = "#{discourseUrl}/session/sso_login?sso=#{respPayload}&sig=#{respSig}"
      )
)
Router.route("/account/resetpassword/:token", ->
  @render("resetPassword")
)

configureHotCodePush = (url) ->
  if R.any(((pattern) -> new RegExp(pattern).test(url)), [
    "/create", "/account/forgotpassword", "/login", "/account/resetpassword/.+"
  ])
    logger.debug("Disallowing hot code push for route '#{url}'")
    Session.set("hotCodePushAllowed", false)
  else if url in ["/", "/about", "/account", "/discourse/sso", "/logout"] or \
      S.startsWith("/u/", url)
    if !Session.get("isEditingProject")
      logger.debug("Allowing hot code push for route '#{url}'")
      Session.set("hotCodePushAllowed", true)
  else
    throw new Error("Unrecognized route '#{url}'")

Router.onBeforeAction(->
  configureHotCodePush(@url)
  Session.set("isProjectModified", false)

  if @url in ["/create", "/discourse/sso"] and !Meteor.userId()?
    logger.debug('User not logged in, rendering login page')
    @render('login')
  else if Session.get("isWaiting")
    logger.debug("In waiting mode")
    @render("loading")
  else
    if S.startsWith('/account', @url)
      curSection = "account"
    else if S.startsWith("/create", @url)
      curSection = "create"
    else if S.startsWith("/about", @url)
      curSection = "about"
    else
      curSection = "explore"
    Session.set("currentSection", curSection)

    logger.debug('User is authenticated')
    @next()
)
