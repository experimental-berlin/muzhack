logger = new Logger("slingshot")

Slingshot.fileRestrictions("pictures", {
  allowedFileTypes: ["image/jpeg", "image/png", "image/gif",],
  maxSize: 10 * 1024 * 1024, # 10 MB (use null for unlimited)
})
Slingshot.fileRestrictions("files", {
  allowedFileTypes: null,
  maxSize: 10 * 1024 * 1024, # 10 MB (use null for unlimited)
})
Slingshot.fileRestrictions("pictures-backup", {
  allowedFileTypes: ["image/jpeg", "image/png", "image/gif",],
  maxSize: 10 * 1024 * 1024, # 10 MB (use null for unlimited)
})
Slingshot.fileRestrictions("files-backup", {
  allowedFileTypes: null,
  maxSize: 10 * 1024 * 1024, # 10 MB (use null for unlimited)
})

createSlingshotDirective = (name, typeStr, bucket) ->
  Slingshot.createDirective(name, Slingshot.S3Storage, {
    bucket: bucket,
    acl: "public-read",
    authorize: ->
      # Deny uploads if user is not logged in.
      if !@userId?
        throw new Meteor.Error("Login Required", "Please login before uploading files")
      return true
    ,
    key: (file, metadata) ->
      logger.debug("Upload directive called for #{typeStr} #{file.name}:", file, metadata)
      "#{metadata.folder}/#{file.name}"
    ,
  })

if Meteor.isServer
  # TODO: Verify that user is owner of destination project
  bucket = getSetting("S3Bucket")
  backupBucket = "backup.#{bucket}"
  createSlingshotDirective("pictures", "picture", bucket)
  createSlingshotDirective("files", "file", bucket)
  createSlingshotDirective("pictures-backup", "picture", backupBucket)
  createSlingshotDirective("files-backup", "file", backupBucket)
