logger = new Logger("methods")

Meteor.methods({
  createProject: (id, title, tags, text) ->
    if !@userId?
      throw new Error("You must be logged in to call this method")

    user = Meteor.users.findOne({_id: @userId})
    metadata = {
      owner: user.username,
      projectId: id,
      title: title,
      tags: tags,
      created: moment().utc().format(),
    }
    logger.info("Creating project #{user.username}/#{id}:", metadata)
    data = _.extend(metadata, {
      text: text,
    })
    Projects.insert(data)
  ,
  getUserFullName: (username) ->
    user = Meteor.users.findOne({username: username})
    if user?
      user.profile.name
    else
      logger.warn("Could not find user by username '#{username}'")
})
