logger = new Logger('routing')

Router.configure(
  layoutTemplate: 'layout'
)
Router.route('/', ->
  @render('home')
)
Router.onBeforeAction(->
  if !Meteor.userId()?
    logger.debug('User not logged in, rendering login page')
    this.render('login')
  else
    logger.debug('User is authenticated')
    this.next()
)