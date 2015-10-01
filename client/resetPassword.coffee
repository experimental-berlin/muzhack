logger = new Logger("resetPassword")

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
        Router.go("/")
    )
})
