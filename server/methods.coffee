logger = new Logger("methods")

getUser = (data) ->
  if !data.userId?
    throw new Error("You must be logged in to call this method")

  Meteor.users.findOne({_id: data.userId})

getSetting = (name) ->
  value = Meteor.settings[name]
  if !value?
    throw new Error("You must define '#{name}' in Meteor's settings")
  value

Meteor.methods({
  createProject: (id, title, description, instructions, tags, pictures, files) ->
    user = getUser(@)

    if Projects.findOne({owner: user.username, projectId: id})?
      throw new Error("Project '#{user.username}/#{id}' already exists")

    metadata = {
      owner: user.username,
      projectId: id,
      title: title,
      tags: tags,
      pictures: pictures,
      files: files,
      created: moment().utc().toDate(),
    }
    logger.info("Creating project #{user.username}/#{id}:", metadata)
    data = R.merge(metadata, {
      description: description,
      instructions: instructions,
    })
    Projects.insert(data)
  updateProject: (owner, id, title, description, instructions, tags, pictures, files) ->
    s3Bucket = getSetting('S3Bucket')
    s3Client = new AWS.S3({
      accessKeyId: getSetting('AWSAccessKeyId'),
      secretAccessKey: getSetting('AWSSecretAccessKey'),
      region: getSetting('AWSRegion'),
      params: {
        Bucket: s3Bucket,
      },
    })
    user = getUser(@)
    logger.info("User #{user.username} updating project #{owner}/#{id}, s3Bucket: '#{s3Bucket}'")
    logger.debug("Pictures:", pictures)
    logger.debug("Files:", files)
    selector = {owner: owner, projectId: id}
    project = Projects.findOne(selector)
    if !project?
      throw new Error("Couldn't find any project '#{owner}/#{id}'")

    removeStaleFiles = (oldFiles, newFiles, fileType) ->
      removedFiles = R.differenceWith(((a, b) -> a.url == b.url), oldFiles, newFiles)
      for file in removedFiles
        filePath = "u/#{owner}/#{id}/#{fileType}s/#{file.name}"
        logger.debug("Removing outdated #{fileType} '#{filePath}'")
        s3Client.deleteObjectSync({
          Key: filePath,
        })

    removeStaleFiles(project.pictures, pictures, 'picture')
    removeStaleFiles(project.files, files, 'file')

    Projects.update(selector, {$set: {
      title: title,
      description: description,
      instructions: instructions,
      tags: R.map(S.trim(null), tags.split(',')),
      pictures: pictures,
      files: files,
    }})
  removeProject: (id) ->
    user = getUser(@)
    project = Projects.findOne({projectId: id})
    if !project?
      return
    if project.owner != user.username
      throw new Meteor.Error("unauthorized", "Only the owner may remove a project")

    Projects.remove({projectId: id})
})
