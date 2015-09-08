logger = new Logger("editProject")
pictureDropzone = null
fileDropzone = null

disableProjectEditing = ->
  Session.set("isEditingProject", false)

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

saveProject = (owner, projectId) ->
  title = trimWhitespace($("#title-input").val())
  description = descriptionEditor.value()
  instructions = instructionsEditor.value()
  tags = R.map(trimWhitespace, S.wordsDelim(/,/, $("#tags-input").val()))
  licenseSelect = document.getElementById("license-select")
  license = licenseSelect.options[licenseSelect.selectedIndex].value

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
        notificationService.warn("Error", "Uploading pictures failed")
      )
    if !R.isEmpty(queuedFiles)
      logger.debug("Processing #{queuedFiles.length} file(s)")
      filesPromise = fileDropzone.processFiles(queuedFiles, uploadData)
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
      logger.info("Saving project...")
      transformFiles = R.map(R.pick(['width', 'height', 'size', 'url', 'name', 'type', 'fullPath']))
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
      logger.debug("title: #{title}, description: #{description}, tags: #{S.join(",", tags)}")
      Meteor.call('updateProject', owner, projectId, title, description, instructions, tags,
        license, pictureFiles, files, (error) ->
          Session.set("isWaiting", false)
          if error?
            logger.error("Updating project on server failed: #{error}")
            notificationService.warn("Error", "Saving project to server failed: #{error}.")
          else
            disableProjectEditing()
            logger.info("Successfully saved project")
      )
    , (error) ->
      Session.set("isWaiting", false)
    )

Template.editProject.onRendered(->
  logger.debug("Project editing view rendered")
  Session.set("isWaiting", false)
  Session.set("isProjectModified", false)
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
  pictureDropzone = dropzoneService.createDropzone("picture-dropzone", true, @data.pictures)
)
Template.filesEditor.onRendered(->
  logger.debug("Files editor rendered")
  fileDropzone = dropzoneService.createDropzone("file-dropzone", false, @data.files)
)
Template.project.events({
  'change #title-input': onChange
  'change #tags-input': onChange
  'click #save-project': ->
    if !Session.get("isEditingProject")
      logger.debug("Ignoring request to save project, since session var isEditingProject is false")
      return

    Session.set("isWaiting", true)
    try
      saveProject(@owner, @projectId)
    catch error
      Session.set("isWaiting", false)
      throw error
  'click #cancel-edit': ->
    doCancel = () ->
      logger.debug("User confirmed canceling edit")
      Session.set("isProjectModified", false)
      disableProjectEditing()
    dontCancel = () ->
      logger.debug("User rejected canceling edit")

    isModified = Session.get("isProjectModified")
    logger.debug("Canceling editing of project, dirty: #{isModified}")
    if isModified
      logger.debug("Asking user whether to cancel project editing or not")
      notificationService.question("Discard Changes?",
        "Are you sure you wish to discard your changes?", doCancel, dontCancel)
    else
      disableProjectEditing()
  'click #remove-project': ->
    doRemove = () =>
      logger.debug("User confirmed removing project")
      Session.set("isWaiting", true)
      try
        logger.info("Removing project...")
        Meteor.call("removeProject", @projectId, (error) ->
          Session.set("isWaiting", false)
          if error?
            logger.error("Removing project on server failed: #{error}")
            notificationService.warn("Error", "Removing project on server failed: #{error}.")
          else
            logger.info("Successfully removed project")
            disableProjectEditing()
            Router.go('/')
        )
      catch error
        Session.set("isWaiting", false)
        throw error
    dontRemove = () ->
      logger.debug("User rejected removing project")

    logger.debug("Asking user whether to remove project or not")
    notificationService.question("Remove project?",
      "Are you sure you wish remove this project?", doRemove, dontRemove)
  "click #remove-all-pictures": ->
    logger.debug("Removing all pictures")
    dropzoneService.clearDropzone(pictureDropzone)
  "click #remove-all-files": ->
    logger.debug("Removing all files")
    dropzoneService.clearDropzone(fileDropzone)
})
Template.editProject.helpers(
  tagsString: -> @tags.join(',')
  isWaiting: -> Session.get("isWaiting")
  licenseOptions: ->
    ({id: id, name: license.name, isSelected: id == @licenseId} for id, license of licenses)
)
Template.picturesEditor.helpers(
  projectHasPictures: ->
    dropzoneService.hasFiles(pictureDropzone)
)
Template.filesEditor.helpers(
  projectHasFiles: -> dropzoneService.hasFiles(fileDropzone)
)
