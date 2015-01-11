@ProjectController = RouteController.extend(
  data: -> Projects.findOne(
    owner: @params.owner,
    projectId: @params.project,
  )
)

Template.project.helpers(
  creationDateString: ->
    moment(this.created).format("MMMM Do YYYY")
  ,
  userFullName: ->
    Meteor.users.findOne({username: this.owner}).profile.name
  ,
  tagsString: ->
    @tags.join(',')
  ,
)
