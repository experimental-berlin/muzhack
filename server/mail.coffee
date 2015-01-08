logger = new Logger("Mail")

Meteor.startup(->
  secret = Meteor.settings['mandrillSecret']
  process.env.MAIL_URL = "smtp://#{encodeURIComponent("arve.knudsen@gmail.com")}:" +
    "#{encodeURIComponent(secret)}@#{encodeURIComponent("smtp.mandrillapp.com")}:587"
  logger.debug("SMTP server URL: '#{process.env.MAIL_URL}'")
)