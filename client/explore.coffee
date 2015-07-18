logger = new Logger("explore")

Template.explore.helpers({
  isEmpty: ->
    !Projects.findOne()?
  ,
})

getQualifiedId = (project) ->
  "#{project.owner}/#{project.projectId}"

getIsotopeContainer = () -> $("#isotope-container")

createProjectElement = (project) ->
  getThumbnail = () ->
    if !R.isEmpty(project.pictures || []) then project.pictures[0].url else \
      '/images/revox-reel-to-reel-resized.jpg'

  $("<div class=\"project-item\" data-id=\"#{getQualifiedId(project)}\">
    <a href=\"/#{project.owner}/#{project.projectId}\">
      <div class=\"project-item-header\">
        <div class=\"project-item-title\">#{project.title}</div>
        <div class=\"project-item-author\">#{project.owner}</div>
      </div>
      <img class=\"project-item-image\" src=\"#{getThumbnail()}\" />
    </a>
  </div>")[0]

Template.explore.onRendered(->
  logger.debug("Template explore has been rendered")

  projectsCursor = Projects.find({}, {sort: [["created", "asc"]]})
  projects = projectsCursor.fetch()
  @autorun(->
    logger.debug("Installing change observer")
    ignore = true
    projectsCursor.observe({
      added: (project) ->
        if ignore
          return
        logger.debug("A project (#{getQualifiedId(project)}) was added, updating Isotope grid")
        $projElem = createProjectElement(project)
        getIsotopeContainer().isotope("insert", $projElem)
      ,
      changed: (project) ->
        qualifiedId = getQualifiedId(project)
        logger.debug("A project (#{qualifiedId}) was changed, updating Isotope grid")
        projectElem = document.querySelector("[data-id=#{qualifiedId}]")
        if !projectElem?
          logger.debug("Couldn't find element corresponding to project")
        else
          logger.debug("Found element corresponding to project", projectElem)
      ,
      removed: (project) ->
        qualifiedId = getQualifiedId(project)
        logger.debug("A project (#{qualifiedId}) was removed, updating Isotope grid")
        projectElem = document.querySelector("[data-id='#{qualifiedId}']")
        if !projectElem?
          logger.debug("Couldn't find element corresponding to project")
        else
          logger.debug("Found element corresponding to project", projectElem)
          getIsotopeContainer().isotope("remove", projectElem).isotope("layout")
      ,
    })
    ignore = false
    logger.debug("Installed change observer")
  )

  $projectElems = R.map(createProjectElement, projects)
  logger.debug("Configuring Isotope")
  getIsotopeContainer().isotope({
    itemSelector: ".project-item",
    layoutMode: 'fitRows',
  })
    .isotope("insert", $projectElems)
)
