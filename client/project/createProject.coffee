logger = new Logger("create")

pictureDropzone = null
fileDropzone = null

onChange = ->
  logger.debug("Project has changed - setting dirty state")
  Session.set("isProjectModified", true)

handleEditorRendered = (editor, text) ->
  # Attach editor to DOM
  editor.render(text)
  editor.hooks.set("onChange", onChange)

Template.create.onRendered(->
  logger.debug("Project creation view rendered")
  Session.set("isWaiting", false)
  Session.set("isProjectModified", false)
  for editor in [descriptionEditor, instructionsEditor,]
    editor.setMode('ace/mode/markdown')
  document.getElementById("id-input").focus()
)
Template.create.helpers({
  isWaiting: -> Session.get("isWaiting")
  licenseOptions: -> ({id: licenseId, name: license.name} for licenseId, license of licenses)
})
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
  pictureDropzone = dropzoneService.createDropzone("picture-dropzone", true, null)
)
Template.createFiles.onRendered(->
  logger.debug("Files editor rendered")
  fileDropzone = dropzoneService.createDropzone("file-dropzone", false, null)
)

getParameters = () ->
  projectId = trimWhitespace($('#id-input').val())
  title = trimWhitespace($('#title-input').val())
  description = descriptionEditor.getText()
  instructions = instructionsEditor.getText()
  tags = R.map(trimWhitespace, S.wordsDelim(/,/, $("#tags-input").val()))
  username = Meteor.user().username
  licenseSelect = document.getElementById("license-select")
  license = licenseSelect.options[licenseSelect.selectedIndex].value
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
  [projectId, title, description, instructions, tags, license, username, queuedPictures,
    queuedFiles,]

createProject = () ->
  logger.debug("Create button was clicked")
  button = event.currentTarget
  logger.debug("Disabling create button")
  button.disabled = true
  [projectId, title, description, instructions, tags, license, username, queuedPictures,
    queuedFiles] = getParameters()

  uploadFiles = () ->
    if !R.isEmpty(queuedPictures)
      logger.debug("Processing #{queuedPictures.length} picture(s)")
      picturesPromise = pictureDropzone.processFiles(queuedPictures, {
        owner: username,
        projectId: projectId,
      })
    else
      picturesPromise = new Promise((resolve) -> resolve([]))
    picturesPromise
      .catch((error) ->
        logger.error("Uploading pictures failed: #{error}")
        notificationService.warn("Error", "Uploading pictures failed")
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
        notificationService.warn("Error", "Uploading files failed")
      )
    [picturesPromise, filesPromise]

  [picturesPromise, filesPromise] = uploadFiles()
  Promise.all([picturesPromise, filesPromise])
    .then(([uploadedPictures, uploadedFiles]) ->
      logger.debug("Uploading files/pictures finished successfully")
      transformFiles = R.map(R.pick(['width', 'height', 'size', 'url', 'name', 'type', 'fullPath']))
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
        license, pictureFiles, files, (error) ->
          Session.set("isWaiting", false)
          logger.debug("Re-enabling create button")
          button.disabled = false
          if error?
            logger.error("Creating project on server failed: #{error}")
            notificationService.warn("Project Creation Failure",
              "Failed to create project due to error on server")
          else
            logger.info("Successfully created project")
            Router.go("/u/#{qualifiedId}")
      )
    , (err) ->
      logger.warn("Uploading files and/or pictures failed")
      Session.set("isWaiting", false)
    )

Template.create.events({
  'change #id-input': onChange
  'change #title-input': onChange
  'change #tags-input': onChange
  'click #create-project': ->
    Session.set("isWaiting", true)
    try
      createProject()
    catch error
      Session.set("isWaiting", false)
      if error instanceof ValidationError
        notificationService.warn("Validation Failed", "#{error.message}.")
        logger.debug("Validation failed")
      else
        throw error
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
