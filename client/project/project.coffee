logger = new Logger("project")

getFileSize = (numBytes) ->
  if numBytes < 1024
    sizeStr = "#{numBytes} B"
  else if numBytes < 1024*1024
    sizeStr = "#{Math.ceil(numBytes / 1024.0)} KB"
  else if numBytes < 1024*1024*1024
    sizeStr = "#{Math.ceil(numBytes / 1024*1024.0)} MB"
  else if numBytes < 1024*1024*1024*1024
    sizeStr = "#{Math.ceil(numBytes / 1024*1024*1024.0)} GB"
  else
    throw new Error("File size too large: #{numBytes}")
  sizeStr

extendFile = (file) ->
  sizeStr = getFileSize(file.size)
  if !file.filename?
    filenameMatch = /^.+\/(.+)$/.exec(file.url)
    if !filenameMatch?
      throw new Error("File URL on invalid format: '#{file.url}'")
    filename = filenameMatch[1]
    logger.debug("Filename #{filename} from URL #{file.url}")
    R.merge(file, {filename: filename, sizeStr: sizeStr})
  else
    R.merge(file, {sizeStr: sizeStr})

@ProjectController = RouteController.extend({
  action: ->
    logger.debug('Getting active tab')
    tabNameMatch = /^.+#([^#]+)$/.exec(@url)
    tabName = if tabNameMatch? then tabNameMatch[1] else 'description'
    if tabName not in ['description', 'instructions', 'files']
      tabName = 'description'
    logger.debug("Current tab name: '#{tabName}'")
    @state.set('activeTab', tabName)
    @render()
  waitOn: -> R.map(Meteor.subscribe, ["projects", "users", "licenses"])
  data: ->
    owner = Meteor.users.findOne(username: @params.owner)
    project = Projects.findOne(
      owner: @params.owner,
      projectId: @params.project,
    )
    if project?
      if owner?
        project.ownerName = owner.profile.name
        logger.debug("Project owner's name: #{project.ownerName}")
      else
        logger.warn('Project has no owner')
      project.zipFileSize = if project.zipFile? then getFileSize(project.zipFile.size) else 0
      project.files = R.map(extendFile, project.files || [])
      project.hasFiles = !R.isEmpty(project.files)
      if R.isEmpty(project.pictures || [])
        logger.debug("Project has no pictures, setting default")
        project.pictures = [{url: '/images/revox-reel-to-reel.jpg'}]
      # TODO: Default to latest version
      licenseId = project.licenseId or "cc-by-sa-3.0"
      license = Licenses.findOne({licenseId: licenseId})
      logger.debug("Project has license #{licenseId}:", Licenses.findOne())
      project.license = license
      Session.set("mainPicture", project.pictures[0].url)
      logger.debug("Project has files: #{project.hasFiles}")
      logger.debug("Project has pictures: #{!R.isEmpty(project.pictures)}")
    project
  onBeforeAction: ->
    data = @data()
    if data?
      @next()
    else
      logger.debug("@data is not defined, rendering not found page")
      @render('projectNotFound', {
        data: {owner: @params.owner, projectId: @params.project},
      })
  onAfterAction: ->
    data = @data()
    if data?
      title = "#{data.owner}/#{data.projectId}"
      logger.debug("Setting title: #{title}")
      SEO.set({
        author: data.owner,
        title: title,
        description: data.description,
        instructions: data.instructions,
        tags: S.join(",", data.tags),
      })
    else
      logger.debug("@data is not defined, cannot set SEO properties")
  onStop: ->
    logger.debug("Route is stopped")
    if Session.get("isEditingProject")
      logger.debug("Exiting editing mode")
      Session.set("isEditingProject", false)
})

Template.project.helpers(
  projectPath: -> "#{@owner} / #{@projectId}"
  isEditing: -> Session.get("isEditingProject")
)
Template.project.events({
  'click #edit-action': ->
    logger.debug("Entering edit mode")
    Session.set("isEditingProject", true)
})
