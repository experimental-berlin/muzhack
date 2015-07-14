logger = new Logger("create")

pictureDropzone = null
fileDropzone = null

Template.create.rendered = ->
  for editor in [descriptionEditor, instructionsEditor,]
    editor.setTheme('ace/theme/monokai')
    editor.setMode('ace/mode/markdown')

handleEditorRendered = (editor, text) ->
  # Make sure Ace is aware of the fact the things might have changed.
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
  pictureDropzone = DropzoneService.createDropzone("picture-dropzone", true, null)
Template.createFiles.rendered = ->
  logger.debug("Files editor rendered")
  fileDropzone = DropzoneService.createDropzone("file-dropzone", false, null)

getParameters = () ->
  projectId = $('#id-input').val()
  title = $('#title-input').val()
  description = descriptionEditor.value()
  instructions = instructionsEditor.value()
  tags = $('#tags-input').val()
  username = Meteor.user().username
  tags = S.words(tags)
  if S.isBlank(projectId) || S.isBlank(title) || R.isEmpty(tags)
    throw new Error('Fields not correctly filled in')
  if S.isBlank(description)
    throw new Error("Description must be filled in")
  if S.isBlank(instructions)
    throw new Error("Instructions must be filled in")
  allPictures = pictureDropzone.getAcceptedFiles()
  if R.isEmpty(allPictures)
    throw new Error("There must be at least one picture")
  queuedPictures = pictureDropzone.getQueuedFiles()
  queuedFiles = fileDropzone.getQueuedFiles()
  [projectId, title, description, instructions, tags, username, queuedPictures, queuedFiles]

Template.create.events({
  'click #create-project': ->
    logger.debug("Create button was clicked")
    button = event.currentTarget
    logger.debug("Disabling create button")
    button.disabled = true
    [projectId, title, description, instructions, tags, username, queuedPictures, queuedFiles] = \
      getParameters()

    uploadFiles = () ->
      if !R.isEmpty(queuedPictures)
        picturesPromise = pictureDropzone.processFiles(queuedPictures, {
          owner: username,
          projectId: projectId,
        })
      else
        picturesPromise = new Promise((resolve) -> resolve([]))
      picturesPromise
        .catch((error) ->
          logger.error("Uploading pictures failed: #{error}")
        )
      if !R.isEmpty(queuedFiles)
        logger.debug("Processing #{queuedFiles.length} file(s)")
        filesPromise = fileDropzone.processFiles(queuedFiles, {
          owner: username,
          projectId: projectId,
        })
      else
        filesPromise = new Promise((resolve) -> resolve([]))
      filesPromise
        .catch((error) ->
          logger.error("Uploading files failed: #{error}")
        )
      [picturesPromise, filesPromise]

    [picturesPromise, filesPromise] = uploadFiles()
    Promise.all([picturesPromise, filesPromise])
      .then(([uploadedPictures, uploadedFiles]) ->
        transformFiles = R.map(R.pick(['width', 'height', 'size', 'url', 'name', 'type']))
        pictureFiles = R.concat(
          transformFiles(pictureDropzone.getExistingFiles()),
          transformFiles(uploadedPictures)
        )
        files = R.concat(
          transformFiles(fileDropzone.getExistingFiles()),
          transformFiles(uploadedFiles)
        )
        qualifiedId = "#{username}/#{projectId}"
        logger.info("Creating project with ID '#{qualifiedId}', title '#{title}' and tag(s) " +
          "#{tags.join(', ')}")
        logger.debug("Picture files:", pictureFiles)
        logger.debug("Files:", files)
        Meteor.call('createProject', projectId, title, description, instructions, tags,
          pictureFiles, files, (error) ->
            logger.debug("Re-enabling create button")
            button.disabled = false
            if error?
              logger.error("Creating project on server failed: #{error}")
              notificationService.warn("Project Creation Failure",
                "Failed to create project due to error on server")
            else
              logger.info("Successfully created project")
              Router.go("/#{qualifiedId}")
        )
      )
  'click #cancel-create': ->
    isModified = Session.get("isProjectModified")
    # TODO: Ask user if there have been modifications
    logger.debug("Canceling creating project, dirty: #{isModified}")
    logger.debug("TODO")
})
