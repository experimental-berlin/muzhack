monitoredDropzoneEvents = [
  "addedfile"
  "addedfiles"
  "debug"
  "error"
  "errormultiple"
  "processing"
  "processingmultiple"
  "removedfile"
  "thumbnail"
  "totaluploadprogress"
  "uploadprogress"
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

dropzoneLogger = new Logger("dropzone")
logger = new Logger("DropzoneService")

handleDropzoneEvent = (event, dropzone, args...) =>
  dropzoneLogger.debug("#{event}:", args)
  if event in ["addedfile", "addedfiles", "removedfile"]
    dep = getDependency(dropzone)
    dep.changed()

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

getDependency = (dropzone) ->
  if !dropzone._meteorDependency?
    dropzone._meteorDependency = new Tracker.Dependency()
  dropzone._meteorDependency

class @DropzoneService
  hasFiles: (dropzone) ->
    if !dropzone?
      false
    else
      dep = getDependency(dropzone)
      dep.depend()
      !R.isEmpty(dropzone.files)

  clearDropzone: (dropzone) ->
    dropzone.removeAllFiles(true)

  createDropzone: (cssId, forPictures, existingFiles) ->
    uploadFiles = (files, data) ->
      processedFiles = []
      s3Folder = "u/#{data.owner}/#{data.projectId}/files"
      if !data.owner? or !data.projectId?
        throw new Error("data is missing owner/projectId")

      logger.debug("Uploading files to folder '#{s3Folder}'")
      uploader = new Slingshot.Upload("files", {
        folder: s3Folder,
      })
      backupUploader = new Slingshot.Upload("files-backup", {
        folder: s3Folder,
      })

      backupFile = (file, downloadUrl, resolve, reject, numTries=0) ->
        numTries += 1
        logger.debug("Backing up file '#{file.name}', try ##{numTries}...")
        backupUploader.send(file, (error) ->
          if error?
            logger.warn("Failed to back up file '#{file.name}': '#{error.message}'")
            if numTries <= 3
              logger.info("Retrying backup")
              backupFile(file, downloadUrl, resolve, reject, numTries)
            else
              logger.warn("Giving up backup of file since we've already tried #{numTries} times")
              reject(error.message)
          else
            logger.debug("Succeeded in backing up file '#{file.name}'")
            file.url = downloadUrl
            file.status = Dropzone.SUCCESS
            processedFiles.push(file)
            if !R.isEmpty(files)
              uploadOneFile(resolve, reject)
            else
              logger.debug('Finished uploading files:', processedFiles)
              resolve(processedFiles)
        )

      realUploadFile = (file, resolve, reject, numTries) ->
        numTries += 1
        logger.debug("Uploading file '#{file.name}', try ##{numTries}...")
        uploader.send(file, (error, downloadUrl) ->
          if error?
            logger.warn("Failed to upload file '#{file.name}': '#{error.message}'")
            if numTries <= 3
              logger.info("Retrying upload")
              realUploadFile(file, resolve, reject, numTries)
            else
              logger.warn("Giving up since we've already tried #{numTries} times")
              reject(error.message)
          else
            backupFile(file, downloadUrl, resolve, reject)
        )

      uploadOneFile = (resolve, reject) ->
        file = files.shift()
        realUploadFile(file, resolve, reject, 0)

      logger.debug('Uploading files...', files)
      new Promise(uploadOneFile)
        .catch((error) ->
          for file in files
            file.status = Dropzone.ERROR
          throw new Error("Failed to upload files: #{error}")
        )

    uploadPictures = (files, data) ->
      pictureDatas = []
      pictures = []
      s3Folder = "u/#{data.owner}/#{data.projectId}/pictures"
      if !data.owner? or !data.projectId?
        throw new Error("data is missing owner/projectId")

      logger.debug("Uploading pictures to folder '#{s3Folder}'")
      uploader = new Slingshot.Upload("pictures", {
        folder: s3Folder,
      })
      backupUploader = new Slingshot.Upload("pictures-backup", {
        folder: s3Folder,
      })

      processOnePicture = (resolve, reject) ->
        file = files.shift()
        logger.debug("Processing picture '#{file.name}'")
        processImage(file, 500, 409, (dataUri) ->
          match = /^data:([^;]+);base64,(.+)$/.exec(dataUri)
          if !match?
            reject(
              "processImage for file '#{file.name}' returned data URI on wrong format: '#{dataUri}'"
            )
          else
            pictureDatas.push([file, match[1], match[2]])
            if !R.isEmpty(files)
              processOnePicture(resolve, reject)
            else
              logger.debug("Finished processing pictures successfully")
              resolve()
        )

      backupPicture = (blob, file, downloadUrl, resolve, reject, numTries) ->
        numTries += 1
        logger.debug("Backing up picture '#{file.name}', try ##{numTries}...")
        backupUploader.send(blob, (error) ->
          if error?
            logger.warn("Failed to back up picture '#{file.name}': '#{error}'")
            if numTries <= 3
              logger.info("Retrying backup")
              backupPicture(blob, file, downloadUrl, resolve, reject, numTries)
            else
              logger.warn("Giving up since we've already tried #{numTries} times")
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

      uploadPicture = (blob, file, type, resolve, reject, numTries) ->
        numTries += 1
        logger.debug("Uploading picture '#{file.name}', type '#{type}', try ##{numTries}...")
        uploader.send(blob, (error, downloadUrl) ->
          if error?
            logger.warn("Failed to upload picture '#{file.name}': '#{error}'")
            if numTries <= 3
              logger.info("Retrying upload")
              uploadPicture(blob, file, type, resolve, reject, numTries)
            else
              logger.warn("Giving up since we've already tried #{numTries} times")
              reject(error.message)
          else
            backupPicture(blob, file, downloadUrl, resolve, reject, 0)
        )

      uploadOnePicture = (resolve, reject) ->
        numTries = 0
        [file, type, b64] = pictureDatas.shift()
        blob = b64ToBlob(b64, type)
        blob.name = file.name
        uploadPicture(blob, file, type, resolve, reject, 0)

      logger.debug("Processing pictures...")
      new Promise(processOnePicture)
        .then(() ->
          logger.debug('Uploading pictures...')
          new Promise(uploadOnePicture)
        )
        .catch((error) ->
          for file in files
            file.status = Dropzone.ERROR
          logger.error("Failed to upload pictures: #{error}")
          throw new Error("Failed to upload pictures: #{error}")
        )

    Dropzone.autoDiscover = false
    dropzone = new Dropzone("##{cssId}", {
      dictDefaultMessage: "Drop #{if forPictures then 'pictures' else 'files'} here to upload",
      addRemoveLinks: true,
      uploadFiles: if forPictures then uploadPictures else uploadFiles,
      autoProcessQueue: false,
      createImageThumbnails: forPictures,
    })
    for event in monitoredDropzoneEvents
      dropzone.on(event, R.partial(handleDropzoneEvent, event, dropzone))
    if existingFiles? && !R.isEmpty(existingFiles)
      description = if forPictures then "picture" else "file"
      picker = if forPictures then ((x) -> R.merge(x, {name: x.url})) else (
        (x) -> R.merge(x, {name: x.filename}))
      fileObjs = R.map(picker, existingFiles)
      logger.debug("Adding files to #{description} dropzone: #{
        R.map(((f) -> f.filename), existingFiles).join(', ')}")
      dropzone.addExistingFiles(fileObjs)

    dropzone
