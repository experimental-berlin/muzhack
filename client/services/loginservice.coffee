logger = new Logger("loginservice")
idSignIn = "login-signin-tab"
idSignup = "login-signup-tab"

findEmail = (template) ->
  return trimWhitespace(template.find('.account-email').value)

findPassword = (template) ->
  return trimWhitespace(template.find('.account-password').value)

class @LoginService
  constructor: ->
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
        $("#signup-username").focus()
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
        logger.debug("User submitted signup form")
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
        password = @getPassword(t)
        if !password?
          return
        website = trimWhitespace(t.find(".account-website").value)
        if not /^https?:\/\/.+$/.test(website)
          notificationService.warn(errorCaption, "You must supply a valid URL")
          return false

        if S.isBlank(password)
          notificationService.warn(errorCaption, "You must supply a password")
          return false
        if password.length < passwordLength
          notificationService.warn(errorCaption,
            "The password must consist of at least #{passwordLength} characters")
          return false

        logger.debug("Registering user '#{username}'")
        # TODO: Implement verification of website URL on server
        Accounts.createUser({
          username: username,
          email: email,
          password: password,
          profile: {
            name: name,
            website: website,
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
      "click #cancel-button": (event) ->
        event.preventDefault()
        logger.debug("Canceling forgot password form")
        Router.go("/login")
      'submit #forgotpassword-form': (e, t) ->
        passwordLength = 8

        e.preventDefault()
        # Retrieve the input field values
        email = findEmail(t)
        logger.debug("Handling forgotten password for email '#{email}'")
        Accounts.forgotPassword({
          email: email,
        }, (err) ->
          if !err?
            logger.debug("Forgotten password has been handled for email #{email}")
            handleRedirect = ->
              if remainingSeconds == 0
                Session.set("isRedirecting", false)
                Router.go('/login')
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

  getPassword: (template) ->
    password = findPassword(template)
    confirmedPassword = trimWhitespace(template.find('.account-password-confirm').value)
    if password != confirmedPassword
      notificationService.warn("Password Confirmation Error", "Passwords don't match")
      null
    else
      password
