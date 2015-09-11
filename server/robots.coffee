logger = new Logger("robots")
if process.env.ENVIRONMENT?.toLowerCase() != "production"
  logger.info("Disabling crawling of site")
  robots.addLine('User-agent: *')
  robots.addLine('Disallow: /')
