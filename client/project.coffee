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
  isEditing: -> Session.get("isEditingProject")
  ,
)
Template.editorContainer.rendered = ->
  logger.debug("Editor container rendered, giving Ace focus")
  editor.setTheme('ace/theme/monokai')
  editor.setMode('ace/mode/markdown')
  if @data.text
    editor.setValue(@data.text, 0)
  editor.setFocus()
  editor.ace.on("change", ->
    logger.debug("Project text has changed - setting dirty state")
    Session.set("isProjectModified", true)
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
  'click #edit-action': ->
    logger.debug("Entering edit mode")
    Session.set("isEditingProject", true)
  'click #save-project': ->
    if !Session.get("isEditingProject")
      return

    Session.set("isEditingProject", false)

    title = $("#title-input").val()
    text = editor.value()
    tags = $("#tags-input").val()

    logger.info("Saving project...")
    logger.debug("title: #{title}, text: #{text}, tags: #{tags}")
    Meteor.call('updateProject', @.projectId, title, text, tags, (error) ->
      if error?
        logger.error("Updating project on server failed: #{error}")
        notificationService.warn("Saving project to server failed: #{error}")
        Session.set("isEditingProject", true)
      else
        logger.info("Successfully saved project")
    )
  'click #cancel-edit': ->
    isModified = Session.get("isProjectModified")
    # TODO: Ask user if there have been modifications
    logger.debug("Canceling editing of project, dirty: #{isModified}")
    Session.set("isEditingProject", false)
  'click #remove-project': ->
    # TODO: Ask user
    Session.set("isEditingProject", false)
    logger.info("Removing project...")
    Meteor.call("removeProject", @.projectId, (error) ->
      if error?
        logger.error("Removing project on server failed: #{error}")
        notificationService.warn("Removing project on server failed: #{error}")
        Session.set("isEditingProject", true)
      else
        logger.info("Successfully removed project")
        Router.go('/')
    )
})
