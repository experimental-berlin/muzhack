logger = new Logger('routing')

Router.configure(
  layoutTemplate: 'layout'
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
  if _.startsWith(@url, "/create") and !Meteor.userId()?
    logger.debug('User not logged in, rendering login page')
    @render('login')
  else
    if _.startsWith(@url, '/account')
      curSection = "account"
    else if _.startsWith(@url, "/create")
      curSection = "create"
    else if _.startsWith(@url, "/about")
      curSection = "about"
    else
      curSection = "explore"
    Session.set("currentSection", curSection)

    logger.debug('User is authenticated')
    @next()
)
