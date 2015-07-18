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

logDropzone = (event, args...) =>
  dropzoneLogger.debug("#{event}:", args)

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

class @DropzoneService
  @createDropzone: (cssId, forPictures, existingFiles) ->
    uploadFiles = (files, data) ->
      processedFiles = []
      s3Folder = "u/#{data.owner}/#{data.projectId}/files"
      if !data.owner? or !data.projectId?
        throw new Error("data is missing owner/projectId")

      logger.debug("Uploading files to folder '#{s3Folder}'")
      uploader = new Slingshot.Upload("files", {
        folder: s3Folder,
      })

      uploadOneFile = (resolve, reject) ->
        file = files.shift()
        logger.debug("Uploading file '#{file.name}'")
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

      processOnePicture = (resolve, reject) ->
        file = files.shift()
        logger.debug("Processing picture '#{file.name}'")
        processImage(file, 500, 409, (dataUri) ->
          match = /^data:([^;]+);base64,(.+)$/.exec(dataUri)
          if !match?
            reject(
              "processImage for file '#{file.name}' returned data URI on wrong format: '#{dataUri}'")
          else
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

    Dropzone.autoDiscover = false
    dropzone = new Dropzone("##{cssId}", {
      dictDefaultMessage: "Drop #{if forPictures then 'pictures' else 'files'} here to upload",
      addRemoveLinks: true,
      uploadFiles: if forPictures then uploadPictures else uploadFiles,
      autoProcessQueue: false,
      createImageThumbnails: forPictures,
    })
    for event in monitoredDropzoneEvents
      dropzone.on(event, R.partial(logDropzone, event))
    if existingFiles? && !R.isEmpty(existingFiles)
      description = if forPictures then "picture" else "file"
      picker = if forPictures then ((x) -> R.merge(x, {name: x.url})) else (
        (x) -> R.merge(x, {name: x.filename}))
      fileObjs = R.map(picker, existingFiles)
      logger.debug("Adding files to #{description} dropzone: #{
        R.map(((f) -> f.filename), existingFiles).join(', ')}")
      dropzone.addExistingFiles(fileObjs)

    dropzone