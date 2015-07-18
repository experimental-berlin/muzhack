logger = new Logger("editProject")
dropzoneLogger = new Logger("dropzone")
pictureDropzone = null
fileDropzone = null

onChange =  ->
  logger.debug("Project has changed - setting dirty state")
  Session.set("isProjectModified", true)

handleEditorRendered = (editor, text) ->
  # Make sure ace is aware of the fact the things might have changed.
  editor.attachAce()
  if text
    editor.setValue(text, 0)
  editor.ace.on("change", onChange)
  editor.ace.clearSelection()
  editor.ace.gotoLine(0, 0)
  editor.ace.session.setUseWrapMode(true)

Template.editProject.onRendered(->
  logger.debug("Project editing view rendered")
  document.getElementById("title-input").focus()
)
Template.descriptionEditor.onRendered(->
  logger.debug("Description editor rendered, giving Ace focus")
  handleEditorRendered(descriptionEditor, @data.description)
)
Template.instructionsEditor.onRendered(->
  logger.debug("Instructions editor rendered, giving Ace focus")
  handleEditorRendered(instructionsEditor, @data.instructions)
)
Template.picturesEditor.onRendered(->
  logger.debug("Pictures editor rendered")
  pictureDropzone = DropzoneService.createDropzone("picture-dropzone", true, @data.pictures)
)
Template.filesEditor.onRendered(->
  logger.debug("Files editor rendered")
  fileDropzone = DropzoneService.createDropzone("file-dropzone", false, @data.files)
)
Template.project.events({
  'change #title-input': onChange
  'change #tags-input': onChange
  'click #save-project': ->
    if !Session.get("isEditingProject")
      return

    owner = @owner
    projectId = @projectId
    title = $("#title-input").val()
    description = descriptionEditor.value()
    instructions = instructionsEditor.value()
    tags = $("#tags-input").val()
    uploadData = {
      owner: owner,
      projectId: projectId,
    }

    allPictures = pictureDropzone.getAcceptedFiles()
    if R.isEmpty(allPictures)
      throw new Error("There must at least be one picture")

    queuedPictures = pictureDropzone.getQueuedFiles()
    queuedFiles = fileDropzone.getQueuedFiles()

    uploadFiles = () ->
      if !R.isEmpty(queuedPictures)
        picturesPromise = pictureDropzone.processFiles(queuedPictures, uploadData)
      else
        picturesPromise = new Promise((resolve) -> resolve([]))
      picturesPromise
        .catch((error) ->
          logger.error("Uploading pictures failed: #{error}")
        )
      if !R.isEmpty(queuedFiles)
        logger.debug("Processing #{queuedFiles.length} file(s)")
        filesPromise = fileDropzone.processFiles(queuedFiles, uploadData)
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
    doCancel = () ->
      logger.debug("User confirmed canceling edit")
      Session.set("isEditingProject", false)
    dontCancel = () ->
      logger.debug("User rejected canceling edit")

    isModified = Session.get("isProjectModified")
    logger.debug("Canceling editing of project, dirty: #{isModified}")
    if isModified
      logger.debug("Asking user whether to cancel project editing or not")
      notificationService.question("Discard Changes?",
        "Are you sure you wish to discard your changes?", doCancel, dontCancel)
    else
        Session.set("isEditingProject", false)
  'click #remove-project': ->
    doCancel = () =>
      logger.debug("User confirmed removing project")
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
    dontCancel = () ->
      logger.debug("User rejected removing project")

    logger.debug("Asking user whether to remove project or not")
    notificationService.question("Remove project?",
      "Are you sure you wish remove this project?", doCancel, dontCancel)
})
Template.editProject.helpers(
  tagsString: -> @tags.join(',')
)
