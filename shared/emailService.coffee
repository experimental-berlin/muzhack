logger = new Logger("EmailService")

class @EmailService
  @notifyDevelopers: (html, subject, context) ->
    if context?
      context.unblock()
    from = "no-reply@#{Meteor.settings.appName}"
    to = Meteor.settings.contactMail
    logger.info("Posting notification email to Mandrill")
    HTTP.post("https://mandrillapp.com/api/1.0/messages/send", {
      data: {
        key: Meteor.settings.mandrillSecret
        message: {
          html: html
          subject: subject
          from_email: from
          from_name: Meteor.settings.appName
          to: [{email: to}]
          headers: {
            "Reply-To": "no-reply@muzhack.com"
          }
        }
        "async": false
      }
    })
