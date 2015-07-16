logger = new Logger("explore")

Template.explore.helpers({
  isEmpty: ->
    !Projects.findOne()
  ,
  projects: ->
    logger.debug("Getting projects")
    extendProject = (project) ->
      picture = if !R.isEmpty(project.pictures || []) then project.pictures[0].url else \
        '/images/revox-reel-to-reel-resized.jpg'
      R.merge(project, {projectThumbnail: picture})
    projects = Projects.find({}, {sort: [["created", "asc"]]})
    logger.debug("Found #{projects.count()} project(s)")
    R.map(extendProject, projects)
  ,
  projectUrl: -> "#{@owner}/#{@projectId}"
  ,
})

Template.explore.onRendered(->
  logger.debug("Template explore has been rendered")

  # TODO: Sort via Isotope
  projects = Projects.find({}, {sort: [["created", "asc"]]})
  getThumbnail = (project) ->
    if !R.isEmpty(project.pictures || []) then project.pictures[0].url else \
      '/images/revox-reel-to-reel-resized.jpg'
  $projectElems = R.map(((p) ->
    $("<div class=\"project-item\">
      <a href=\"/#{p.owner}/#{p.projectId}\">
        <div class=\"project-item-header\">
          <div class=\"project-item-title\">#{p.title}</div>
          <div class=\"project-item-author\">#{p.owner}</div>
        </div>
        <img class=\"project-item-image\" src=\"#{getThumbnail(p)}\" />
      </a>
    </div>")[0]
  ), projects)

  logger.debug("Configuring Isotope")
  $("#isotope-container").isotope({
    itemSelector: ".project-item",
    layoutMode: 'fitRows',
  })
    .isotope("insert", $projectElems)

  # TODO: Observe collection and insert/remove correspondingly into/from Isotope
)
