logger = new Logger("Populate")

Meteor.startup(->
  if !Licenses.findOne()?
    logger.debug("Populating database with licenses")
    Licenses.insert({
      licenseId: "cc-by-sa-3.0"
      name: "Creative Commons - Attribution - Share Alike 3.0"
      url: "http://creativecommons.org/licenses/by-sa/3.0/"
      icons: ["creative-commons", "creative-commons-attribution", "creative-commons-sharealike"]
    })
  else
    logger.debug("Found a license: #{Licenses.findOne().licenseId}")
)
