logger = new Logger("explore")

Template.explore.helpers({
  isEmpty: ->
    !Projects.findOne()
  ,
  projects: ->
    extendProject = (project) ->
      picture = if !R.isEmpty(project.pictures || []) then project.pictures[0] else \
        '/images/revox-reel-to-reel-resized.jpg'
      R.merge(project, {projectThumbnail: picture})
    R.map(extendProject, Projects.find({}, {sort: [["created", "asc"]]}))
  ,
  projectUrl: -> "#{@owner}/#{@projectId}"
  ,
})

Template.explore.rendered = ->
  logger.debug("Initializing Isotope")
  $("#isotope-container").isotope({
    itemSelector: ".project-item",
    layoutMode: 'fitRows',
  })
