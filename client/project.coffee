logger = new Logger("project")

@ProjectController = RouteController.extend({
  action: ->
    logger.debug('Getting active tab')
    tabNameMatch = /^.+#([^#]+)$/.exec(@url)
    tabName = if tabNameMatch? then tabNameMatch[1] else 'description'
    if tabName not in ['description', 'instructions']
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
    if project? && owner?
      project.ownerName = owner.profile.name
      logger.debug("Project owner's name: #{project.ownerName}")
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
