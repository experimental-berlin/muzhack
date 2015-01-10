logger = new Logger('create')

Template.create.rendered = ->
  editor.setTheme('ace/theme/monokai')
  editor.setMode('ace/mode/markdown')

Template.create.events(
  'click #create-button': ->
    id = $('#input-id').val()
    title = $('#input-title').val()
    tags = $('#input-tags').val()
    text = editor.value()
    logger.debug("Create button was clicked")

    tags = _.words(tags)
    if _.isBlank(id) || _.isBlank(title) || _.isEmpty(tags)
      throw new Error('Fields not correctly filled in')

    username = Meteor.user().username
    qualifiedId = "#{username}/#{id}"
    logger.info("Creating project with ID '#{qualifiedId}', title '#{title}' and tag(s) #{tags.join(', ')}")
    logger.info("Text: '#{text}'")

    Projects.insert(
      owner: username,
      projectId: id,
      title: title,
      tags: tags,
      text: text,
      created: moment().utc().format(),
    )
    Router.go("/#{qualifiedId}")
)
