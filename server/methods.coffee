logger = new Logger("methods")

getUser = (data) ->
  if !data.userId?
    throw new Error("You must be logged in to call this method")

  Meteor.users.findOne({_id: data.userId})

@getSetting = (name) ->
  value = Meteor.settings[name]
  if !value?
    throw new Error("You must define '#{name}' in Meteor's settings")
  value

getS3Objs = ->
  s3Bucket = getSetting('S3Bucket')
  s3Client = new AWS.S3({
    accessKeyId: getSetting('AWSAccessKeyId'),
    secretAccessKey: getSetting('AWSSecretAccessKey'),
    region: getSetting('AWSRegion'),
    params: {
      Bucket: s3Bucket,
    },
  })
  [s3Bucket, s3Client]

downloadFile = (url) ->
  logger.debug("Downloading file '#{file.url}'...")
  numTries = 0
  while true
    numTries += 1
    try
      result = HTTP.get(file.url)
      if result.statusCode != 200
        throw new Error("Couldn't download '#{file.url}', status code: #{result.statusCode}")
      else
        break
    catch
      if numTries >= 3
        throw

  result.content

createZip = (files, user, id, s3Bucket, s3Client) ->
  logger.debug("Generating zip...")
  zip = new JSZip()
  for file in files
    content = downloadFile(file)
    logger.debug("Adding file '#{file.name}' to zip")
    zip.file(file.name, content)
  output = zip.generate({
    type: "nodebuffer",
    compression: "DEFLATE",
  })
  logger.debug("Uploading zip file to S3 (bucket: '#{s3Bucket}')")
  filePath = "u/#{user.username}/#{id}/#{id}.zip"
  s3Client.putObjectSync({
    Key: filePath,
    ACL: "public-read",
    Body: output,
  })
  region = getSetting('AWSRegion')
  # TODO: Try to get URL from S3
  ["https://s3.#{region}.amazonaws.com/#{s3Bucket}/#{filePath}", output.length]

verifyLicense = (licenseId) ->
  if !licenses[licenseId]?
    throw new Error("Invalid license '#{licenseId}'")

Meteor.methods({
  createProject: (id, title, description, instructions, tags, license, pictures, files) ->
    user = getUser(@)

    if Projects.findOne({owner: user.username, projectId: id})?
      throw new Error("Project '#{user.username}/#{id}' already exists")

    [s3Bucket, s3Client] = getS3Objs()
    [zipUrl, zipSize] = createZip(files, user, id, s3Bucket, s3Client)
    verifyLicense(license)

    metadata = {
      owner: user.username,
      projectId: id,
      title: title,
      tags: tags,
      licenseId: license,
      created: moment().utc().toDate(),
    }
    logger.info("Creating project #{user.username}/#{id}:", metadata)
    data = R.merge(metadata, {
      description: description,
      instructions: instructions,
      pictures: pictures,
      files: files,
      zipFile: {
        url: zipUrl,
        size: zipSize,
      },
    })
    Projects.insert(data)
  updateProject: (owner, id, title, description, instructions, tags, license, pictures, files) ->
    [s3Bucket, s3Client] = getS3Objs()
    user = getUser(@)
    verifyLicense(license)
    logger.info("User #{user.username} updating project #{owner}/#{id}, s3Bucket: '#{s3Bucket}'")
    logger.debug("Pictures:", pictures)
    logger.debug("Files:", files)
    selector = {owner: owner, projectId: id}
    project = Projects.findOne(selector)
    if !project?
      throw new Error("Couldn't find any project '#{owner}/#{id}'")
    if project.owner != user.username
      throw new Meteor.Error("unauthorized", "Only the owner may edit a project")

    removeStaleFiles = (oldFiles, newFiles, fileType) ->
      if !oldFiles?
        return

      removedFiles = R.differenceWith(((a, b) -> a.url == b.url), oldFiles, newFiles)
      if !R.isEmpty(removedFiles)
        logger.debug(
          "Removing #{removedFiles.length} stale #{fileType}(s) (type: #{fileType}), old " +
          "files vs new files:", oldFiles, newFiles)
      for file in removedFiles
        filePath = "u/#{owner}/#{id}/#{fileType}s/#{file.name}"
        logger.debug("Removing outdated #{fileType} '#{filePath}'")
        s3Client.deleteObjectSync({
          Key: filePath,
        })

    removeStaleFiles(project.pictures, pictures, 'picture')
    removeStaleFiles(project.files, files, 'file')

    [zipUrl, zipSize] = createZip(files, user, id, s3Bucket, s3Client)

    Projects.update(selector, {$set: {
      title: title,
      description: description,
      instructions: instructions,
      tags: R.map(trimWhitespace, tags.split(',')),
      licenseId: license,
      pictures: pictures,
      files: files,
      zipFile: {
        url: zipUrl,
        size: zipSize,
      },
    }})
  removeProject: (id) ->
    removeFolder = () ->
      objects = s3Client.listObjectsSync({Prefix: dirPath})
      toDelete = R.map(((o) -> {Key: o.Key}), objects.Contents)
      result = s3Client.deleteObjectsSync({Delete: {Objects: toDelete}})
      logger.debug("Deleted #{objects.Contents.length} object(s), result:", result)
      # API will list max 1000 objects
      if objects.Contents.length == 1000
        logger.debug("We hit max number of listed objects, deleting recursively")
        removeFolder()

    user = getUser(@)
    project = Projects.findOne({projectId: id})
    if !project?
      return
    if project.owner != user.username
      throw new Meteor.Error("unauthorized", "Only the owner may remove a project")

    logger.debug()

    logger.debug("Removing project '#{user.username}/#{id}'")
    Projects.remove({owner: user.username, projectId: id})

    [s3Bucket, s3Client] = getS3Objs()
    dirPath = "u/#{user.username}/#{id}"
    logger.debug("Removing files from S3 bucket '#{s3Bucket}', directory '#{dirPath}'")
    removeFolder()
  verifyDiscourseSso: (payload, sig) ->
    logger.debug("Verifying Discourse SSO parameters")
    user = Meteor.user()
    if !user?
      throw new Meteor.Error("unauthorized", "You must be logged in to perform this operation")
    secret = Meteor.settings.SSO_SECRET
    if !secret?
      logger.error("SSO_SECRET not defined in settings")
      throw new Meteor.Error("internalError", "Internal error")
    gotSig = CryptoJS.HmacSHA256(payload, secret).toString(CryptoJS.enc.Hex)
    logger.debug("Got sig #{gotSig}")
    if gotSig == sig
      rawPayload = new Buffer(payload, 'base64').toString()
      m = /nonce=(.+)/.exec(rawPayload)
      if !m?
        logger.warn("Payload on bad format", rawPayload)
        throw new Meteor.Error("bad-payload", "Payload is on bad format")
      nonce = m[1]
      rawRespPayload = "nonce=#{nonce}&email=#{user.emails[0].address}&" +
        "external_id=#{user.username}&username=#{user.username}&name=#{user.profile.name}"
      logger.debug("Responding with payload '#{rawRespPayload}'")
      respPayload = new Buffer(rawRespPayload).toString('base64')
      respSig = CryptoJS.HmacSHA256(respPayload, secret).toString(CryptoJS.enc.Hex)
      [respPayload, respSig]
    else
      msg = "Payload signature isn't as expected"
      logger.warn(msg)
      throw new Meteor.Error("bad-signature", msg)
  createTrelloBoard: (token, name, description, organization) ->
    user = getUser(@)
    params = R.pickBy(((value) ->
      value?
    ), {
      name: name
      desc: description
      idOrganization: organization
      prefs_permissionLevel: "public"
    })
    logger.debug("Creating Trello board, params:", params)
    appKey = Meteor.settings.public.trelloKey
    try
      result = HTTP.post("https://api.trello.com/1/boards?key=#{appKey}&token=#{token}", {
        params: params
      })
    catch error
      logger.warn("Failed to create Trello board with the following parameters:", params)
      logger.warn("Reason for error: '#{error.message}'")
      throw new Meteor.Error("trello-create", "Failed to create Trello board '#{params.name}'")

    data = result.data
    logger.debug("Created Trello board successfully (ID: #{data.id}), inserting into database")
    insertTrelloBoard(data, user)
  editTrelloBoard: (token, id, name, description, organization) ->
    user = getUser(@)
    board = TrelloBoards.findOne({id: id})
    if board? and board.username != user.username
      throw new Meteor.Error("unauthorized", "You need to be the board owner")

    params = {
      name: name || ""
      desc: description || ""
      idOrganization: organization || ""
    }
    logger.debug("Editing Trello board with ID #{id}, params:", params)
    appKey = Meteor.settings.public.trelloKey
    try
      HTTP.put("https://api.trello.com/1/boards/#{id}?key=#{appKey}&token=#{token}", {
        params: params
      })
    catch error
      logger.warn("Failed to edit Trello board with ID #{id}")
      logger.warn("Reason for error: '#{error.message}'")
      throw new Meteor.Error("trelloEdit", "Failed to edit Trello board with ID #{id}")

    logger.debug("Edit Trello board successfully (ID: #{id}), updating database, params:", params)
    TrelloBoards.upsert({id: id}, {$set: {
      name: params.name
      description: params.desc
      idOrganization: params.idOrganization
    }})
  removeTrelloBoard: (id) ->
    verifyArg(id, 'id')
    logger.debug("Asked to remove Trello board ID #{id}")

    user = getUser(@)
    board = TrelloBoards.findOne({id: id})
    if board? and board.username != user.username
      throw new Meteor.Error("unauthorized", "You need to be the board owner")

    TrelloBoards.remove({id: id})
    logger.debug("Successfully removed Trello board with ID #{id}")
  closeTrelloBoard: (token, id) ->
    verifyArg(id, 'id')
    verifyArg(token, 'token')
    logger.debug("Asked to remove and close Trello board ID #{id}")

    user = getUser(@)
    board = TrelloBoards.findOne({id: id})
    if board? and board.username != user.username
      throw new Meteor.Error("unauthorized", "You need to be the board owner")

    appKey = Meteor.settings.public.trelloKey
    try
      logger.debug("Closing Trello board...")
      result = HTTP.put("https://api.trello.com/1/boards/#{id}/closed?key=#{appKey}&token=#{token}",
        {params: {value: true}}
      )
    catch error
      logger.warn("Failed to close Trello board with ID #{id}:")
      logger.warn("Reason for error: '#{error.message}'")
      throw new Meteor.Error("trello-remove", "Failed to remove Trello board with ID #{id}")

    logger.debug("Closed Trello board successfully (ID: #{id}), removing from database")
    TrelloBoards.remove({id: id})
  getExistingTrelloBoards: (token) ->
    verifyArg(token, 'token')
    user = getUser(@)
    appKey = Meteor.settings.public.trelloKey
    try
      result = HTTP.get(
        "https://api.trello.com/1/members/me/boards?filter=open&fields=name,id&" +
          "key=#{appKey}&token=#{token}")
    catch error
      logger.warn("Failed to get Trello boards for user '#{user.username}'")
      logger.warn("Reason for error: '#{error.message}'")
      throw new Meteor.Error("trelloGetBoards", "Failed to get user's boards")
    logger.debug("Result:", result.data)
    R.sortBy(((board) -> board.name), result.data)
  addExistingTrelloBoard: (token, id) ->
    verifyArg(id, 'id')
    verifyArg(token, 'token')
    logger.debug("Asked to add existing Trello board with ID #{id}")

    user = getUser(@)
    board = TrelloBoards.findOne({id: id, username: user.username})
    if board?
      logger.debug("Board is already registered for user")
      return

    appKey = Meteor.settings.public.trelloKey
    try
      result = HTTP.get("https://api.trello.com/1/boards/#{id}?key=#{appKey}&token=#{token}")
    catch error
      logger.warn("Failed to get Trello board with ID #{id}:")
      logger.warn("Reason for error: '#{error.message}'")
      throw new Meteor.Error("trelloAddExistingBoard", "Failed to get Trello board with ID #{id}")

    insertTrelloBoard(result.data, user)
  # logOutOfDiscourse: () ->
  #   user = Meteor.user()
  #   if !user?
  #     return
  #   username = user.username
  #   if !S.isBlank(Meteor.settings.discourseApiKey) and !S.isBlank(Meteor.settings.discourseUser)
  #     discourseLogoutUrl = "#{Meteor.settings.public.discourseUrl}/admin/users/#{username}/log_out" +
  #       "?api_key=#{Meteor.settings.discourseApiKey}&api_username=#{Meteor.settings.discourseUser}"
  #     HTTP.post(discourseLogoutUrl)
  #   else
  #     logger.debug("Not logging user out of Discourse since API key/user not defined")
})

insertTrelloBoard = (data, user) ->
  TrelloBoards.upsert({id: data.id}, {$set: {
    id: data.id
    username: user.username
    name: data.name
    url: data.url
    description: data.desc
    organization: data.idOrganization
  }})

verifyArg = (arg, argName) ->
  if !arg?
    logger.warn("Client didn't specify #{argName}")
    throw new Meteor.Error("argumentError", "#{argName} is undefined")
