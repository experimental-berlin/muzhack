logger = new Logger('create')

Template.create.rendered = ->
  for editor in [descriptionEditor, instructionsEditor,]
    editor.setTheme('ace/theme/monokai')
    editor.setMode('ace/mode/markdown')

Template.create.events(
  'click #create-button': (event) ->
    id = $('#input-id').val()
    title = $('#input-title').val()
    tags = $('#input-tags').val()
    text = editor.value()
    logger.debug("Create button was clicked")
    button = event.currentTarget
    logger.debug("Disabling create button")
    button.disabled = true

    tags = S.words(tags)
    if S.isBlank(id) || S.isBlank(title) || R.isEmpty(tags)
      throw new Error('Fields not correctly filled in')

    username = Meteor.user().username
    qualifiedId = "#{username}/#{id}"
    logger.info("Creating project with ID '#{qualifiedId}', title '#{title}' and tag(s) #{tags.join(', ')}")
    logger.info("Text: '#{text}'")

    Meteor.call("createProject", id, title, tags, text, (error) ->
      logger.debug("Re-enabling create button")
      button.disabled = false
      if !error?
        Router.go("/#{qualifiedId}")
      else
        logger.warn("Server error when trying to create project:", error)
        notificationService.warn("Project Creation Failure",
          "Failed to create project due to error on server")
    )
)
