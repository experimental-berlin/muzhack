@logError = (logger, message, args...) ->
  logger.error(message, args...)
  dateTime = moment().utc().format("MMMM Do YYYY, HH:mm:ss")
  html = """#{dateTime} - An error was reported on a MuzHack server:
<pre>#{message}</pre>
"""
  EmailService.notifyDevelopers(html, "MuzHack - Server Error Reported")
