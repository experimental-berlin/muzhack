logger = new Logger("slingshot")

Slingshot.fileRestrictions("pictures", {
  allowedFileTypes: ["image/jpeg", "image/png", "image/gif",],
  maxSize: 10 * 1024 * 1024, # 10 MB (use null for unlimited)
})

if Meteor.isServer
  # TODO: Verify that user is owner of destination project
  Slingshot.createDirective("pictures", Slingshot.S3Storage, {
    authorize: ->
      # Deny uploads if user is not logged in.
      if !@userId?
        throw new Meteor.Error("Login Required", "Please login before uploading files")
      return true
    ,
    key: (file, metadata) ->
      logger.debug("Upload directive called for file #{file.name}:", file, metadata)
      "#{metadata.folder}/#{file.name}"
    ,
  })
