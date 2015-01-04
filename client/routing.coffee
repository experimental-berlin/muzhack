Router.configure(
  layoutTemplate: 'layout'
)
Router.route('/', ->
  @render('home')
)
Router.onBeforeAction(->
  if !Meteor.userId()?
    console.log('User not logged in, rendering login page')
    this.render('login')
  else
    console.log('User logged in')
    this.next()
)