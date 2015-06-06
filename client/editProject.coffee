logger = new Logger("editProject")
dropzoneLogger = new Logger("dropzone")
pictureDropzone = null

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
    pictureUrls = []
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
        pictureDatas.push([file.name, match[1], match[2]])
        if !R.isEmpty(files)
          processOnePicture(resolve, reject)
        else
          resolve()
      )

    uploadOnePicture = (resolve, reject) ->
      [name, type, b64] = pictureDatas.shift()
      logger.debug("Uploading file '#{name}', type '#{type}'")
      blob = b64ToBlob(b64, type)
      blob.name = name
      uploader.send(blob, (error, downloadUrl) ->
        if error?
          reject(error.message)
        else
          pictureUrls.push(downloadUrl)
          if !R.isEmpty(pictureDatas)
            uploadOnePicture(resolve, reject)
          else
            for file in files
              file.status = Dropzone.SUCCESS
            logger.debug('Finished uploading pictures, URLs:', pictureUrls)
            resolve(pictureUrls)
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
      pictureUrlsPromise = pictureDropzone.processFiles(queuedFiles)
    else
      throw new Error("There must at least be one picture")

    pictureUrlsPromise
      .then((pictureUrls) ->
        logger.info("Saving project...")
        logger.debug("Picture URLs:", pictureUrls)
        logger.debug("title: #{title}, description: #{description}, tags: #{tags}")
        Meteor.call('updateProject', @.projectId, title, description, instructions, tags, (error) ->
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
