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

logDropzone = (event, args...) =>
  dropzoneLogger.debug("#{event}:", args)

class @DropzoneService
  @createDropzone: (cssId, forPictures, existingFiles, destFolder) ->
    uploadFiles = (files) ->
      processedFiles = []
      category = if forPictures then "pictures" else "files"
      uploader = new Slingshot.Upload(category, {
        folder: "u/#{data.owner}/#{data.projectId}/#{destFolder}",
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

    Dropzone.autoDiscover = false
    dropzone = new Dropzone("##{cssId}", {
      dictDefaultMessage: "Drop #{if forPictures then 'pictures' else 'files'} here to upload",
      addRemoveLinks: true,
      uploadFiles: uploadFiles,
      autoProcessQueue: false,
      createImageThumbnails: forPictures,
    })
    for event in monitoredDropzoneEvents
      dropzone.on(event, R.partial(logDropzone, event))
    if existingFiles
        logger.debug("Adding files to file dropzone: #{R.map(((f) -> f.filename), existingFiles).join(
          ', ')}")
        dropzone.addExistingFiles(
          R.map(((x) -> R.merge(x, {name: x.filename})), existingFiles)
        )

    dropzone
