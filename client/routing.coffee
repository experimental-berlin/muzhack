logger = new Logger('routing')

Router.configure(
  layoutTemplate: 'layout'
)
Router.route('/', ->
  @render('home')
)
Router.route('/account/forgotpassword', ->
  @render('forgotPassword')
, name: 'forgotPassword'
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