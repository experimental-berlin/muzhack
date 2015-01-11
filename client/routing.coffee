logger = new Logger('routing')

Router.configure(
  layoutTemplate: 'layout'
)
Router.route('/', ->
  @render('home')
,
  onBeforeAction: ->
    Session.set("currentSection", "explore")
    @next()
)
Router.route('/account/forgotpassword', ->
  @render('forgotPassword')
,
  name: 'forgotPassword',
  onBeforeAction: ->
    Session.set("currentSection", "account")
    @next()
)
Router.route('/about', ->
  @render('about')
,
  onBeforeAction: ->
    Session.set("currentSection", "about")
    @next()
)
Router.route('/create', ->
  @render('create')
,
  onBeforeAction: ->
    Session.set("currentSection", "create")
    @next()
)
Router.onBeforeAction(->
  if !Meteor.userId()?
    logger.debug('User not logged in, rendering login page')
    @render('login')
  else
    logger.debug('User is authenticated')
    @next()
, {
  except: ['forgotPassword',]
})
