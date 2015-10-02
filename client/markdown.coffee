Template = Package.templating.Template
Blaze = Package.blaze.Blaze
HTML = Package.htmljs.HTML

Meteor.startup(->
  Blaze.Template.registerHelper("markdown", new Template("markdown", ->
    view = @
    content = ''
    if view.templateContentBlock
      content = Blaze._toText(view.templateContentBlock, HTML.TEXTMODE.STRING)
    converter = Markdown.getSanitizingConverter()
    return HTML.Raw(converter.makeHtml(content))
  ))
)
