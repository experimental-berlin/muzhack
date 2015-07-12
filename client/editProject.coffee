logger = new Logger("editProject")
dropzoneLogger = new Logger("dropzone")
pictureDropzone = null
fileDropzone = null

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
  })
  for event in monitoredDropzoneEvents
    pictureDropzone.on(event, R.partial(logDropzone, event))
  logger.debug("Adding pictures to dropzone thumbnails: #{data.pictures.join(', ')}")
  pictureDropzone.addExistingFiles(data.pictures)
Template.filesEditor.rendered = ->
    data = @data

    uploadFiles = (files) ->
      processedFiles = []
      uploader = new Slingshot.Upload("files", {
        folder: "u/#{data.owner}/#{data.projectId}/files",
      })

      uploadOneFile = (resolve, reject) ->
        file = files.shift()
        logger.debug("Uploading file '#{file.name}'")
        # blob = b64ToBlob(b64, type)
        # blob.name = file.name
        uploader.send(file, (error, downloadUrl) ->
          if error?
            logger.warn("Failed to upload file '#{file.name}': '#{error.message}'")
            reject(error.message)
          else
            logger.debug("Succeeded in uploading file '#{file.name}'")
            file.url = downloadUrl
            file.status = Dropzone.SUCCESS
            processedFiles.push(file)
            if !R.isEmpty(files)
              uploadOneFile(resolve, reject)
            else
              logger.debug('Finished uploading files:', processedFiles)
              resolve(processedFiles)
        )

      logger.debug('Uploading files...', files)
      new Promise(uploadOneFile)
        .catch((error) ->
          for file in files
            file.status = Dropzone.ERROR
          throw new Error("Failed to upload files: #{error}")
        )

    logger.debug("Files editor rendered")
    Dropzone.autoDiscover = false
    fileDropzone = new Dropzone("#file-dropzone", {
      dictDefaultMessage: "Drop files here to upload",
      addRemoveLinks: true,
      uploadFiles: uploadFiles,
      autoProcessQueue: false,
      createImageThumbnails: false,
    })
    for event in monitoredDropzoneEvents
      fileDropzone.on(event, R.partial(logDropzone, event))
    logger.debug("Adding files to file dropzone: #{R.map(((f) -> f.filename), data.files).join(
      ', ')}")
    fileDropzone.addExistingFiles(
      R.map(((x) -> R.merge(x, {name: x.filename})), data.files)
    )
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
