logger = new Logger("methods")

getUser = (data) ->
  if !data.userId?
    throw new Error("You must be logged in to call this method")

  Meteor.users.findOne({_id: data.userId})

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
    data = _.extend(metadata, {
      text: text,
    })
    Projects.insert(data)
  getUserFullName: (username) ->
    user = Meteor.users.findOne({username: username})
    if user?
      user.profile.name
    else
      logger.warn("Could not find user by username '#{username}'")
  updateProjectText: (id, text) ->
    logger.debug("User #{@userId} updating text of project #{id}")
    user = getUser(@)
    Projects.update({projectId: id}, {$set: {text: text}})
  removeProject: (id) ->
    user = getUser(@)

    project = Projects.findOne({projectId: id})
    if !project?
      return
    if project.owner != user.username
      throw new Meteor.Error("unauthorized", "Only the owner may remove a project")

    Projects.remove({projectId: id})
})
