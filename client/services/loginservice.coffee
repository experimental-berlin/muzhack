logger = new Logger("loginservice")
idSignIn = "login-signin-tab"
idSignup = "login-signup-tab"

findEmail = (t) ->
  return trimWhitespace(t.find('.account-email').value)

findPassword = (t) ->
  return trimWhitespace(t.find('.account-password').value)

class @LoginService
  setupTemplate: ->
    Template.login.helpers({
      showSignIn: ->
        return !Session.get("isInSignupMode")
      ,
      showSignUp: ->
        return !!Session.get("isInSignupMode")
      ,
      signInClass: ->
        return if !Session.get("isInSignupMode") then "active" else ""
      ,
      signUpClass: ->
        return if Session.get("isInSignupMode") then "active" else ""
      ,
    })
    Template.login.events({
      "click #login-signin-tab": ->
        if !Session.get("isInSignupMode")
          return

        logger.debug("Showing signin form")
        $("##{idSignIn}").addClass('active')
        $("##{idSignup}").removeClass('active')
        $("#signin-email").focus()
        # Display form corresponding to tab
        Session.set("isInSignupMode", false)
      "click #login-signup-tab": ->
        if Session.get("isInSignupMode")
          return

        $("##{idSignup}").addClass('active')
        $("##{idSignIn}").removeClass('active')
        $("#signup-email").focus()
        logger.debug("Showing signup form")
        Session.set("isInSignupMode", true)
      ,
      'submit #signin-form': (event, template) ->
        event.preventDefault()
        # Retrieve the input field values
        emailOrUsername = findEmail(template)
        password = findPassword(template)

        logger.debug("Logging in with email or username '#{emailOrUsername}'")
        Meteor.loginWithPassword(emailOrUsername, password, (err) ->
          if (err)
            notificationService.warn("Login Error", err.reason)
          else
            # The user has been logged in.
        )

        false
      ,
      'submit #signup-form': (e, t) ->
        errorCaption = "Signup Error"
        passwordLength = 8

        e.preventDefault()

        username = trimWhitespace(t.find(".account-username").value)
        if S.isBlank(username)
          notificationService.warn(errorCaption, "You must supply a username")
          return false
        name = trimWhitespace(t.find(".account-name").value)
        if S.isBlank(name)
          notificationService.warn(errorCaption, "You must supply a name")
          return false
        email = findEmail(t)
        password = findPassword(t)
        confirmedPassword = trimWhitespace(t.find('.account-password-confirm').value)
        if password != confirmedPassword
          notificationService.warn(errorCaption, "Passwords don't match")
          return false

        if S.isBlank(password)
          notificationService.warn(errorCaption, "You must supply a password")
          return false
        if password.length < passwordLength
          notificationService.warn(errorCaption,
            "The password must consist of at least #{passwordLength} characters")
          return false

        logger.debug("Registering user #{email}")
        Accounts.createUser({
          username: username,
          email: email,
          password: password,
          profile: {
            name: name,
          },
        }, (err) ->
          if !err?
            logger.debug("User has been registered and logged in")
          else
            notificationService.warn(errorCaption, err.reason)
            logger.warn("Couldn't register user: #{err}")
        )

        Session.set("isInSignupMode", false)
        false
      ,
    })
    Template.forgotPassword.helpers({
      showRedirect: -> Session.get("isRedirecting")
      ,
      remainingSecondsString: ->
        seconds = Session.get("remainingSeconds")
        "#{seconds} second#{if seconds != 1 then "s" else ""}"
      ,
    })
    Template.forgotPassword.events({
      'submit #forgotpassword-form': (e, t) ->
        passwordLength = 8

        e.preventDefault()
        # Retrieve the input field values
        email = findEmail(t)
        logger.debug("Handling forgotten password for email #{email}")
        Accounts.forgotPassword({
          email: email,
        }, (err) ->
          if !err?
            logger.debug("Forgotten password has been handled for email #{email}")
            handleRedirect = ->
              if remainingSeconds == 0
                Session.set("isRedirecting", false)
                Router.go('/')
              else
                remainingSeconds -= 1
                Session.set("remainingSeconds", remainingSeconds)
                setTimeout(handleRedirect, 1000)

            remainingSeconds = 5
            Session.set("remainingSeconds", remainingSeconds)
            setTimeout(handleRedirect, 1000)
            Session.set("isRedirecting", true)
          else
            notificationService.warn("Error", err.reason)
            logger.warn("Couldn't handle forgotten password: #{err}")
        )

        return false
      ,
    })
