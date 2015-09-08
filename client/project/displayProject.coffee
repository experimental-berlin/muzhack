logger = new Logger("displayProject")

class ProjectTab
  constructor: (@title, @icon) ->
    @name = @title.toLowerCase()

  classes: ->
    activeTab = Iron.controller().state.get('activeTab')
    if activeTab == @name
      logger.debug("#{@name} is active tab")
      'active'
    else
      ''

getActiveTab = () ->
  activeTab = Iron.controller().state.get('activeTab')
  logger.debug("Active tab is #{activeTab}")
  activeTab

Template.displayProject.helpers(
  creationDateString: ->
    moment(@created).format("MMMM Do YYYY")
  userFullName: -> @ownerName
  username: -> @ownerUsername
  projectTabs: -> [
    new ProjectTab('Description', 'file-text')
    new ProjectTab('Instructions', 'book')
    new ProjectTab('Files', 'puzzle4')
  ]
  displayDescription: -> getActiveTab() == 'description'
  displayInstructions: -> getActiveTab() == 'instructions'
  displayFiles: -> getActiveTab() == 'files'
  mainPicture: -> Session.get("mainPicture")
  tagsString: -> @tags.join(', ')
  canEdit: ->
    user = Meteor.user()
    if !user?
      logger.debug("User is not logged in - cannot edit project")
      return false
    canEdit = user.username == @owner
    logger.debug("User is logged in as '#{user.username}' - can edit project: #{canEdit}")
    canEdit
  license: -> licenses[@licenseId]
)
Template.displayProject.events({
  'click .tabs > li': ->
    Iron.controller().state.set('activeTab', @name)
    logger.debug("Set activeTab: #{@name}")
  'click #thumbnails > a': ->
    logger.debug("Thumbnail clicked: #{@url}")
    Session.set("mainPicture", String(@url))
})
Template.projectFiles.helpers({
  projectHasFiles: -> !R.isEmpty(@files)
})
