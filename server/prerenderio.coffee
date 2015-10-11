logger = new Logger("PrerenderIO")

Meteor.startup(->
  token = process.env.PRERENDER_TOKEN
  if !S.isBlank(token)
    logger.debug("Setting PrerenderIO token: '#{token}'")
    prerenderio.set('prerenderToken', token)
  else
    logger.debug("Not setting PrerenderIO token")
)
