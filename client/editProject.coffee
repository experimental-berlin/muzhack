logger = new Logger("editProject")
dropzoneLogger = new Logger("dropzone")
pictureDropzone = null

monitoredDropzoneEvents = [
  "addedfile"
  "addedfiles"
  "removedfile"
  "thumbnail"
  "error"
  "errormultiple"
  "processing"
  "processingmultiple"
  "uploadprogress"
  "totaluploadprogress"
  "sending"
  "sendingmultiple"
  "success"
  "successmultiple"
  "canceled"
  "canceledmultiple"
  "complete"
  "completemultiple"
  "reset"
  "maxfilesexceeded"
  "maxfilesreached"
  "queuecomplete"
]

b64ToBlob = (b64Data, contentType, sliceSize) ->
  sliceSize = sliceSize || 512

  byteCharacters = atob(b64Data)
  byteArrays = []
  offset = 0
  while offset < byteCharacters.length
    slice = byteCharacters.slice(offset, offset + sliceSize)
    byteNumbers = (slice.charCodeAt(i) for i in [0...slice.length])
    byteArray = new Uint8Array(byteNumbers)
    byteArrays.push(byteArray)
    offset += sliceSize

  new Blob(byteArrays, {type: contentType})

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
  data = @data

  uploadPictures = (files) ->
    pictureDatas = []
    pictures = []
    uploader = new Slingshot.Upload("pictures", {
      folder: "u/#{data.owner}/#{data.projectId}/pictures",
    })

    processOnePicture = (resolve, reject) ->
      file = files.shift()
      logger.debug("Processing picture '#{file.name}'")
      processImage(file, 500, 409, (dataUri) ->
        match = /^data:([^;]+);base64,(.+)$/.exec(dataUri)
        if !match?
          reject(
            "processImage for file '#{file.name}' returned data URI on wrong format: '#{dataUri}'")
        pictureDatas.push([file, match[1], match[2]])
        if !R.isEmpty(files)
          processOnePicture(resolve, reject)
        else
          resolve()
      )

    uploadOnePicture = (resolve, reject) ->
      [file, type, b64] = pictureDatas.shift()
      logger.debug("Uploading file '#{file.name}', type '#{type}'")
      blob = b64ToBlob(b64, type)
      blob.name = file.name
      uploader.send(blob, (error, downloadUrl) ->
        if error?
          reject(error.message)
        else
          file.url = downloadUrl
          file.status = Dropzone.SUCCESS
          pictures.push(file)
          if !R.isEmpty(pictureDatas)
            uploadOnePicture(resolve, reject)
          else
            logger.debug('Finished uploading pictures, URLs:', pictures)
            resolve(pictures)
      )

    logger.debug("Processing pictures...")
    new Promise(processOnePicture)
      .then(() ->
        logger.debug('Uploading pictures...')
        new Promise(uploadOnePicture)
      )
      .catch((error) ->
        for file in files
          file.status = Dropzone.ERROR
        throw new Error("Failed to upload pictures: #{error}")
      )

  logger.debug("Pictures editor rendered")
  Dropzone.autoDiscover = false
  pictureDropzone = new Dropzone("#picture-dropzone", {
    acceptedFiles: "image/*",
    dictDefaultMessage: "Drop pictures here to upload",
    addRemoveLinks: true,
    uploadFiles: uploadPictures,
    autoProcessQueue: false,
    dictDefaultMessage: "Drop pictures here to add",
  })
  for event in monitoredDropzoneEvents
    pictureDropzone.on(event, R.partial(logDropzone, event))
  logger.debug("Adding pictures to dropzone thumbnails: #{data.pictures.join(', ')}")
  pictureDropzone.addExistingFiles(data.pictures)
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

    allFiles = pictureDropzone.getAcceptedFiles()
    if R.isEmpty(allFiles)
      throw new Error("There must at least be one picture")

    queuedFiles = pictureDropzone.getQueuedFiles()
    if !R.isEmpty(queuedFiles)
      picturesPromise = pictureDropzone.processFiles(queuedFiles)
    else
      picturesPromise = new Promise((resolve) -> resolve([]))
    picturesPromise
      .then((uploadedPictures) ->
        logger.info("Saving project...")
        transformFiles = R.map(R.pick(['width', 'height', 'size', 'url', 'name', 'type']))
        pictures = R.concat(
          transformFiles(pictureDropzone.getExistingFiles()),
          transformFiles(uploadedPictures)
        )
        logger.debug("Picture files:", pictures)
        logger.debug("title: #{title}, description: #{description}, tags: #{tags}")
        Meteor.call('updateProject', owner, projectId, title, description, instructions, tags,
          pictures, (error) ->
            if error?
              logger.error("Updating project on server failed: #{error}")
              notificationService.warn("Saving project to server failed: #{error}")
            else
              Session.set("isEditingProject", false)
              logger.info("Successfully saved project")
        )
      )
      .catch((error) ->
        logger.error("Uploading pictures failed: #{error}")
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
