Logger.setLevel("debug")

@editor = MandrillAce.getInstance()
logger = new Logger('app')

Meteor.startup(->
  @loginService = new LoginService()
  @loginService.setupTemplate()
  @notificationService = new NotificationService()
  @accountService = new AccountService()
)

Template.registerHelper('appName', -> 'MusitechHub')

Template.home.rendered = ->
  editor.setTheme('ace/theme/monokai')
  editor.setMode('ace/mode/markdown')

Template.home.helpers
  status: ->
    lineNumber = editor.lineNumber ? 0
    column = editor.column ? 0
    output = "(#{lineNumber}, #{column})"

    selection = editor.selection
    if selection and not _.isEqual selection.start, selection.end
      start = selection.start
      end = selection.end
      #TODO: Check for start == end and display differently?
      output += "\tSelection (#{start.lineNumber}, #{start.column}) -> (#{end.lineNumber}, #{end.column})"
    if editor.checksum
      output += "\tChecksum: #{editor.checksum}"
    output

  ast: ->
    #Need to set editor.parseEnabled = true
    JSON.stringify editor.parsedBody, null, 2

  functions: ->
    children = (parent)->
      _.each parent, (child)->
        console.log(child)
        if _.isArray(child) or _.isObject(child)
          console.log("fetch my children")
          children(child)
    return children(editor.parsedBody)

  errorDisplay: ->
    e = editor.parseError
    return unless e
    "SYNTAX ERROR: (#{e.lineNumber}, #{e.column}) #{e.description}"

class Accountbutton
  constructor: (icon, name) ->
    @icon = icon
    @name = name
    @klass = "enabled"

Template.accountbar.helpers({
  buttons: ->
    return [
      new Accountbutton('exit', 'logout')
    ]
})
