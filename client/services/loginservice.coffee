logger = new Logger("loginservice")
idSignIn = "login-signin-tab"
idSignup = "login-signup-tab"

findEmail = (t) ->
  return _(t.find('.account-email').value).trim()

findPassword = (t) ->
  return t.find('.account-password').value

class @LoginService
  constructor: ->
    Session.set("loginForm", "signin")

  setupTemplate: =>
    Template.login.helpers({
      showSignIn: =>
        return Session.get("loginForm") == "signin"
      ,
      showSignUp: =>
        return Session.get("loginForm") == "signup"
    })
    Template.login.events({
      "click #login-signin-tab": ->
        if Session.get("loginForm") == "signin"
          return

        logger.debug("Showing signin form")
        $("##{idSignIn}").addClass('active')
        $("##{idSignup}").removeClass('active')
        $("#signin-email").focus()
        # Display form corresponding to tab
        Session.set("loginForm", "signin")
      "click #login-signup-tab": ->
        if Session.get("loginForm") == "signup"
          return

        $("##{idSignup}").addClass('active')
        $("##{idSignIn}").removeClass('active')
        $("#signup-email").focus()
        logger.debug("Showing signup form")
        Session.set("loginForm", "signup")
      ,
      'submit #signin-form': (e, t) ->
        e.preventDefault()
        # retrieve the input field values
        email = findEmail(t)
        password = findPassword(t)

        Meteor.loginWithPassword(email, password, (err) ->
          if (err)
            notificationService.warn("Login Error", err.reason)
          else
            # The user has been logged in.
        )

        return false;
      ,
      'submit #signup-form': (e, t) ->
        caption = "Signup Error"
        passwordLength = 8

        e.preventDefault()
        # retrieve the input field values
        email = findEmail(t)
        password = findPassword(t)
        confirmedPassword = _(t.find('.account-password-confirm').value).trim()
        if password != confirmedPassword
          notificationService.warn(caption, "Passwords don't match")
          return false

        if _(password).isBlank()
          notificationService.warn(caption, "You must supply a password")
          return false
        if password.length < passwordLength
          notificationService.warn(caption, "The password must consist of at least #{passwordLength} characters")
          return false

        logger.debug("Registering user #{email}")
        Accounts.createUser({
          email: email,
          password: password
        }, (err) ->
          if !err?
            logger.debug("User has been registered and logged in")
          else
            notificationService.warn(caption, err.reason)
            logger.warn("Couldn't register user: #{err}")
        )

        return false;
    })
