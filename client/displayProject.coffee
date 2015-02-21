logger = new Logger("displayProject")

Template.displayProject.helpers(
  creationDateString: ->
    moment(this.created).format("MMMM Do YYYY")
  userFullName: ->
    template = Template.instance()
    rVar = template? && template.ownerFullName
    if rVar?
      rVar.get()
    else
      null
  tagsString: ->
    @tags.join(',')
)
Template.displayProject.created = ->
    rVar = @ownerFullName
    if !rVar?
      rVar = @ownerFullName = new ReactiveVar()
    username = @data.owner
    logger.debug("Getting full name of user '#{username}' from server")
    Meteor.call("getUserFullName", username, (error, fullName) ->
      if !error?
        logger.debug("Server returned full name of user '#{username}': '#{fullName}'")
        rVar.set(fullName)
      else
        logger.warn("Failed to get name of project owner '#{@owner}':", error)
        notificationService.warn("Server Error", "Could not get name of project owner")
    )
