logger = new Logger('create')

Template.create.rendered = ->
  for editor in [descriptionEditor, instructionsEditor,]
    editor.setTheme('ace/theme/monokai')
    editor.setMode('ace/mode/markdown')

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

Template.createDescription.rendered = ->
  logger.debug("Description editor rendered, giving Ace focus")
  handleEditorRendered(descriptionEditor)
Template.createInstructions.rendered = ->
  logger.debug("Instructions editor rendered, giving Ace focus")
  handleEditorRendered(instructionsEditor)
Template.createPictures.rendered = ->
  logger.debug("Pictures editor rendered")
  pictureDropzone = DropzoneService.createDropzone(
    "picture-dropzone", true, null, "pictures")
Template.createFiles.rendered = ->
  logger.debug("Files editor rendered")
  fileDropzone = DropzoneService.createDropzone("file-dropzone", false, null, "files")

Template.project.events({
  'click #save-project': ->
    if !Session.get("isEditingProject")
      return

    owner = @owner
    projectId = @projectId
    title = $("#title-input").val()
    description = descriptionEditor.value()
    instructions = instructionsEditor.value()
    tags = $("#tags-input").val()

    allPictures = pictureDropzone.getAcceptedFiles()
    if R.isEmpty(allPictures)
      throw new Error("There must at least be one picture")

    queuedPictures = pictureDropzone.getQueuedFiles()
    if !R.isEmpty(queuedPictures)
      picturesPromise = pictureDropzone.processFiles(queuedPictures)
    else
      picturesPromise = new Promise((resolve) -> resolve([]))
    picturesPromise
      .catch((error) ->
        logger.error("Uploading pictures failed: #{error}")
      )
    queuedFiles = fileDropzone.getQueuedFiles()
    if !R.isEmpty(queuedFiles)
      logger.debug("Processing #{queuedFiles.length} file(s)")
      filesPromise = fileDropzone.processFiles(queuedFiles)
    else
      filesPromise = new Promise((resolve) -> resolve([]))
    filesPromise
      .catch((error) ->
        logger.error("Uploading files failed: #{error}")
      )
    Promise.all([picturesPromise, filesPromise])
      .then(([uploadedPictures, uploadedFiles]) ->
        logger.info("Saving project...")
        transformFiles = R.map(R.pick(['width', 'height', 'size', 'url', 'name', 'type']))
        pictureFiles = R.concat(
          transformFiles(pictureDropzone.getExistingFiles()),
          transformFiles(uploadedPictures)
        )
        files = R.concat(
          transformFiles(fileDropzone.getExistingFiles()),
          transformFiles(uploadedFiles)
        )
        logger.debug("Picture files:", pictureFiles)
        logger.debug("Files:", files)
        logger.debug("title: #{title}, description: #{description}, tags: #{tags}")
        Meteor.call('updateProject', owner, projectId, title, description, instructions, tags,
          pictureFiles, files, (error) ->
            if error?
              logger.error("Updating project on server failed: #{error}")
              notificationService.warn("Saving project to server failed: #{error}")
            else
              Session.set("isEditingProject", false)
              logger.info("Successfully saved project")
        )
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
    Meteor.call("removeProject", @projectId, (error) ->
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


Template.create.events(
  'click #create-button': (event) ->
    id = $('#input-id').val()
    title = $('#input-title').val()
    tags = $('#input-tags').val()
    text = editor.value()
    logger.debug("Create button was clicked")
    button = event.currentTarget
    logger.debug("Disabling create button")
    button.disabled = true

    tags = S.words(tags)
    if S.isBlank(id) || S.isBlank(title) || R.isEmpty(tags)
      throw new Error('Fields not correctly filled in')

    username = Meteor.user().username
    qualifiedId = "#{username}/#{id}"
    logger.info("Creating project with ID '#{qualifiedId}', title '#{title}' and tag(s) #{tags.join(', ')}")
    logger.info("Text: '#{text}'")

    Meteor.call("createProject", id, title, tags, text, (error) ->
      logger.debug("Re-enabling create button")
      button.disabled = false
      if !error?
        Router.go("/#{qualifiedId}")
      else
        logger.warn("Server error when trying to create project:", error)
        notificationService.warn("Project Creation Failure",
          "Failed to create project due to error on server")
    )
)
