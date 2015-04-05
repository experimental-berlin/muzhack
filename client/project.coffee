logger = new Logger("project")

extendFile = (file) ->
  if file.size < 1024
    sizeStr = "#{file.size} B"
  else if file.size < 1024*1024
    sizeStr = "#{Math.ceil(file.size / 1024.0)} KB"
  else if file.size < 1024*1024*1024
    sizeStr = "#{Math.ceil(file.size / 1024*1024.0)} MB"
  else if file.size < 1024*1024*1024*1024
    sizeStr = "#{Math.ceil(file.size / 1024*1024*1024.0)} GB"
  else
    throw new Error("File size too large: #{file.size}")

  filenameMatch = /^.+\/(.+)$/.exec(file.url)
  if !filenameMatch?
    throw new Error("File URL on invalid format: '#{file.url}'")
  filename = filenameMatch[1]
  logger.debug("Filename #{filename} from URL #{file.url}")
  R.merge(file, {filename: filename, sizeStr: sizeStr})

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
  waitOn: -> [Meteor.subscribe("projects"), Meteor.subscribe("users")]
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
      project.files = R.map(extendFile, project.files || [])
      project.hasFiles = !R.isEmpty(project.files)
      logger.debug("Project has files: #{project.hasFiles}")
    project
  onAfterAction: ->
    data = @data()
    if data?
      title = "#{data.owner}/#{data.projectId}"
      logger.debug("Setting title: #{title}")
      SEO.set({
        title: "#{title}"
      })
    else
      logger.debug("@data is not defined")
  onStop: ->
    logger.debug("Route is stopped")
    if Session.get("isEditingProject")
      logger.debug("Exiting editing mode")
      Session.set("isEditingProject", false)
})

Template.project.helpers(
  projectPath: -> "#{@owner} / #{@projectId}"
  isEditing: -> Session.get("isEditingProject")
  tagsString: -> @tags.join(',')
)
Template.project.events({
  'click #edit-action': ->
    logger.debug("Entering edit mode")
    Session.set("isEditingProject", true)
})
