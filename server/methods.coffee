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
  updateProject: (id, title, text, tags) ->
    logger.debug("User #{@userId} updating project #{id}")
    user = getUser(@)
    Projects.update({projectId: id}, {$set: {title: title, text: text, tags: _.map(
      tags.split(','), (tag) -> _.trim(tag))}})
  removeProject: (id) ->
    user = getUser(@)

    project = Projects.findOne({projectId: id})
    if !project?
      return
    if project.owner != user.username
      throw new Meteor.Error("unauthorized", "Only the owner may remove a project")

    Projects.remove({projectId: id})
})
