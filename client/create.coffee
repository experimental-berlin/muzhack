logger = new Logger("create")

pictureDropzone = null
fileDropzone = null

Template.create.onRendered(->
  logger.debug("Template create rendered")
  Session.set("isProjectModified", false)
  for editor in [descriptionEditor, instructionsEditor,]
    editor.setTheme('ace/theme/monokai')
    editor.setMode('ace/mode/markdown')
)

onChange = ->
  logger.debug("Project has changed - setting dirty state")
  Session.set("isProjectModified", true)

handleEditorRendered = (editor, text) ->
  # Make sure Ace is aware of the fact the things might have changed.
  editor.attachAce()
  if text
    editor.setValue(text, 0)
  editor.ace.on("change", onChange)
  editor.ace.clearSelection()
  editor.ace.gotoLine(0, 0)
  editor.ace.session.setUseWrapMode(true)

Template.create.onRendered(->
  logger.debug("Project creation view rendered")
  document.getElementById("id-input").focus()
)
Template.createDescription.onRendered(->
  logger.debug("Description editor rendered, giving Ace focus")
  handleEditorRendered(descriptionEditor)
)
Template.createInstructions.onRendered(->
  logger.debug("Instructions editor rendered, giving Ace focus")
  handleEditorRendered(instructionsEditor)
)
Template.createPictures.onRendered(->
  logger.debug("Pictures editor rendered")
  pictureDropzone = DropzoneService.createDropzone("picture-dropzone", true, null)
)
Template.createFiles.onRendered(->
  logger.debug("Files editor rendered")
  fileDropzone = DropzoneService.createDropzone("file-dropzone", false, null)
)

getParameters = () ->
  projectId = $('#id-input').val()
  title = $('#title-input').val()
  description = descriptionEditor.value()
  instructions = instructionsEditor.value()
  tags = $('#tags-input').val()
  username = Meteor.user().username
  tags = S.words(tags)
  if S.isBlank(projectId) || S.isBlank(title) || R.isEmpty(tags)
    throw new ValidationError('Fields not correctly filled in')
  if S.isBlank(description)
    throw new ValidationError("Description must be filled in")
  if S.isBlank(instructions)
    throw new ValidationError("Instructions must be filled in")
  allPictures = pictureDropzone.getAcceptedFiles()
  if R.isEmpty(allPictures)
    throw new ValidationError("There must be at least one picture")
  queuedPictures = pictureDropzone.getQueuedFiles()
  queuedFiles = fileDropzone.getQueuedFiles()
  [projectId, title, description, instructions, tags, username, queuedPictures, queuedFiles]

Template.create.events({
  'change #id-input': onChange
  'change #title-input': onChange
  'change #tags-input': onChange
  'click #create-project': ->
    logger.debug("Create button was clicked")
    button = event.currentTarget
    logger.debug("Disabling create button")
    button.disabled = true
    try
      [projectId, title, description, instructions, tags, username, queuedPictures,
        queuedFiles] = getParameters()
    catch error
      if error instanceof ValidationError
        notificationService.warn("Validation Failed", "#{error.message}.")
      else
        throw error

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
    doCancel = () ->
      logger.debug("User confirmed canceling create")
      Session.set("isProjectModified", false)
      Router.go("/")
    dontCancel = () ->
      logger.debug("User rejected canceling create")

    isModified = Session.get("isProjectModified")
    logger.debug("Canceling creating project, dirty: #{isModified}")
    if isModified
      logger.debug("Asking user whether to cancel creating project or not")
      notificationService.question("Discard Changes?",
        "Are you sure you wish to discard your changes?", doCancel, dontCancel)
    else
      Router.go("/")
})
