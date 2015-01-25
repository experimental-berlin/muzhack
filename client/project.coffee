logger = new Logger("project")

@ProjectController = RouteController.extend({
  waitOn: -> Meteor.subscribe("projects")
  ,
  data: ->
    Projects.findOne(
      owner: @params.owner,
      projectId: @params.project,
    )
})

Template.project.helpers(
  creationDateString: ->
    moment(this.created).format("MMMM Do YYYY")
  ,
  userFullName: ->
    template = Template.instance()
    rVar = template? && template.ownerFullName
    if rVar?
      rVar.get()
    else
      null
  ,
  tagsString: ->
    @tags.join(',')
  ,
  isEditingText: -> Session.get("isEditingProjectText")
  ,
)
Template.editorContainer.rendered = ->
  logger.debug("Editor container rendered, giving Ace focus")
  editor.setTheme('ace/theme/monokai')
  editor.setMode('ace/mode/markdown')
  editor.setValue(@data.text, 0)
  editor.setFocus()
  editor.ace.on("change", ->
    logger.debug("Project text has changed - setting dirty state")
    Session.set("isProjectTextModified", true)
  )
  editor.ace.clearSelection()
  editor.ace.gotoLine(0, 0)
Template.project.created = ->
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
Template.project.events({
  'click #project-text': ->
    logger.debug('Project text clicked, enabling editing')
    Session.set("isEditingProjectText", true)
  ,
  'blur .ace_editor': ->
    isModified = Session.get("isProjectTextModified")
    stateStr = if isModified then "dirty" else "clean"
    logger.debug("Editor has lost focus - state: #{stateStr}")
    if isModified
      logger.debug("Updating project text on server")
      Meteor.call('updateProjectText', @.projectId, editor.value(), (error) ->
        if error?
          logger.error("Updating project text on server failed: #{error}")
      )
    Session.set("isEditingProjectText", false)
})
