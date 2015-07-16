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

  projects = Projects.find({}, {sort: [["created", "asc"]]})
  logger.debug("Configuring Isotope for #{projects.count()} project(s)")
  getThumbnail = (project) ->
    if !R.isEmpty(project.pictures || []) then project.pictures[0].url else \
      '/images/revox-reel-to-reel-resized.jpg'
  $projectElems = R.map(((p) ->
    $("<a href=\"/#{p.owner}/#{p.projectId}\">
      <div class=\"project-item\">
        <div class=\"project-item-header\">
          <div class=\"project-item-title\">#{p.title}</div>
          <div class=\"project-item-author\">#{p.owner}</div>
        </div>
        <img class=\"project-item-image\" src=\"#{getThumbnail(p)}\" />
      </div>
    </a>")
  ), projects.fetch())
  $isotopeContainer = $("#isotope-container")
  $isotopeContainer.isotope({
    itemSelector: ".project-item",
    layoutMode: 'fitRows',
  })
    .append($projectElems)
    .isotope("appended", $projectElems)
)
