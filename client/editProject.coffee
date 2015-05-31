logger = new Logger("editProject")
dropzoneLogger = new Logger("dropzone")
pictureDropzone = null

uploadPictures = (files) ->
  logger.debug('Uploading pictures:', files)

logDropzone = (event, args...) =>
  dropzoneLogger.debug("#{event}:", args)

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
Template.picturesEditor.rendered = ->
  logger.debug("Pictures editor rendered")
  Dropzone.autoDiscover = false
  pictureDropzone = new Dropzone("#picture-dropzone", {
    acceptedFiles: "image/*",
    url: "/upload",
    dictDefaultMessage: "Drop pictures here to upload",
    addRemoveLinks: true,
    uploadFiles: uploadPictures,
    autoProcessQueue: false,
    dictDefaultMessage: "Drop pictures here to add",
  })
  for event in pictureDropzone.events
    pictureDropzone.on(event, R.partial(logDropzone, event))
Template.project.events({
  'click #save-project': ->
    if !Session.get("isEditingProject")
      return

    title = $("#title-input").val()
    description = descriptionEditor.value()
    instructions = instructionsEditor.value()
    tags = $("#tags-input").val()

    queuedFiles = pictureDropzone.getQueuedFiles()
    if !R.isEmpty(queuedFiles)
      logger.debug("Uploading pictures...")
      pictureDropzone.processFiles(queuedFiles)

    logger.info("Saving project...")
    logger.debug("title: #{title}, description: #{description}, tags: #{tags}")
    Meteor.call('updateProject', @.projectId, title, description, instructions, tags, (error) ->
      if error?
        logger.error("Updating project on server failed: #{error}")
        notificationService.warn("Saving project to server failed: #{error}")
      else
        Session.set("isEditingProject", false)
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

@previewFile = () ->
  preview = $('img')[0]
  file = $('input[type=file]')[0].files[0]
  reader = new FileReader()

  reader.onloadend = () ->
    logger.debug('Reader has finished loading')
    preview.src = reader.result

  if file?
   reader.readAsDataURL(file)
  else
    preview.src = ''
