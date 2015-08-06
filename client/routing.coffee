logger = new Logger('routing')

Router.configure(
  layoutTemplate: 'layout'
  loadingTemplate: 'loading'
  trackPageView: true
)
Router.route('/login', ->
  logger.debug("Handling login route")
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
Router.route('/', ->
  @render('explore')
, {
    name: 'home',
    waitOn: -> Meteor.subscribe("projects")
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
Router.route('/:owner/:project',
  name: "project"
  controller: ProjectController
)

Router.onBeforeAction(->
  if S.startsWith("/create", @url) and !Meteor.userId()?
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
