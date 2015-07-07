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
  createProject: (id, title, tags, text) ->
    user = getUser(@)

    metadata = {
      owner: user.username,
      projectId: id,
      title: title,
      tags: tags,
      created: moment().utc().toDate(),
    }
    logger.info("Creating project #{user.username}/#{id}:", metadata)
    data = R.merge(metadata, {
      text: text,
    })
    Projects.insert(data)
  updateProject: (owner, id, title, description, instructions, tags, pictures, files) ->
    s3Client = new AWS.S3({
      accessKeyId: getSetting('AWSAccessKeyId'),
      secretAccessKey: getSetting('AWSSecretAccessKey'),
      region: getSetting('AWSRegion'),
      params: {
        Bucket: getSetting('S3Bucket'),
      },
    })
    user = getUser(@)
    logger.debug("User #{user.username} updating project #{owner}/#{id}")
    logger.debug("Pictures:", pictures)
    logger.debug("Files:", files)
    selector = {owner: owner, projectId: id}
    project = Projects.findOne(selector)
    if !project?
      throw new Error("Couldn't find any project '#{owner}/#{id}'")

    removedPictures = R.differenceWith(((a, b) -> a.url == b.url), project.pictures, pictures)
    for picture in removedPictures
      picturePath = "u/#{owner}/#{id}/pictures/#{picture.name}"
      logger.debug("Removing outdated picture '#{picturePath}'")
      s3Client.deleteObjectSync({
        Key: picturePath,
      })

    Projects.update(selector, {$set: {
      title: title,
      text: description,
      instructions: instructions,
      tags: R.map(S.trim(null), tags.split(',')),
      pictures: pictures,
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
