logger = new Logger("editProject")

handleEditorRendered = (editor, text) ->
  # Make sure ace is aware of the fact the things might have changed.
  editor.attachAce()
  if text
    editor.setValue(text, 0)
  editor.setFocus()
  editor.ace.on("change", ->
    logger.debug("Project text has changed - setting dirty state")
    Session.set("isProjectModified", true)
  )
  editor.ace.clearSelection()
  editor.ace.gotoLine(0, 0)
  editor.ace.session.setUseWrapMode(true)

Template.descriptionEditor.rendered = ->
  logger.debug("Description editor rendered, giving Ace focus")
  handleEditorRendered(descriptionEditor, @data.text)
Template.instructionsEditor.rendered = ->
  logger.debug("Instructions editor rendered, giving Ace focus")
  handleEditorRendered(instructionsEditor, @data.instructions)
Template.project.events({
  'click #save-project': ->
    if !Session.get("isEditingProject")
      return

    Session.set("isEditingProject", false)

    title = $("#title-input").val()
    description = descriptionEditor.value()
    instructions = instructionsEditor.value()
    tags = $("#tags-input").val()

    logger.info("Saving project...")
    logger.debug("title: #{title}, description: #{description}, tags: #{tags}")
    Meteor.call('updateProject', @.projectId, title, description, instructions, tags, (error) ->
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
Template.editProject.helpers(
  tagsString: -> @tags.join(',')
)
