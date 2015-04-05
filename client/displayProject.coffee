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
  userFullName: ->
    @ownerName
  projectTabs: -> [
    new ProjectTab('Description')
    new ProjectTab('Instructions')
    new ProjectTab('Files', 'puzzle4')
  ]
  displayDescription: -> getActiveTab() == 'description'
  displayInstructions: -> getActiveTab() == 'instructions'
  displayFiles: -> getActiveTab() == 'files'
  mainPicture: -> Session.get("mainPicture")
)
Template.displayProject.events({
  'click .tabs > li': ->
    Iron.controller().state.set('activeTab', @name)
    logger.debug("Set activeTab: #{@name}")
  'click #thumbnails > a': ->
    logger.debug("Thumbnail clicked: #{@}")
    Session.set("mainPicture", String(@))
})
