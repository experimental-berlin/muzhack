logger = new Logger("resetPassword")

Template.resetPassword.helpers({
  showRedirect: -> Session.get("isRedirecting")
  remainingSecondsString: ->
    seconds = Session.get("remainingSeconds")
    "#{seconds} second#{if seconds != 1 then "s" else ""}"
})
Template.resetPassword.events({
  "submit #reset-password-form": (event, template) ->
    event.preventDefault()
    token = Router.current().params.token
    password = loginService.getPassword(template)
    if !password?
      return

    logger.debug("Reset password form submitted - token: '#{token}'")
    logger.debug("Resetting password...")
    Accounts.resetPassword(token, password, (err) ->
      if err?
        logger.warn("Resetting password failed:", err)
        notificationService.warn("Password Reset Error", err.message)
      else
        logger.info("Resetting password succeeded")
        Session.set("isRedirecting", true)
        remainingSeconds = 5
        Session.set("remainingSeconds", remainingSeconds)

        countDown = ->
          remainingSeconds -= 1
          Session.set("remainingSeconds", remainingSeconds)
          if remainingSeconds > 0
            setTimeout(countDown, 1000)
          else
            Session.set("isRedirecting", false)
            Router.go("/")

        setTimeout(countDown, 1000)
    )
})
