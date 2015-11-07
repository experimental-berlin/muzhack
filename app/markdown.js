'use strict'
let HtmlToReactParser = require('html-to-react/lib/parser')
let React = require('react')
let {getSanitizingConverter,} = require('./pagedown/Markdown.Sanitizer')

module.exports.convertMarkdown = (markdown) => {
  let converter = getSanitizingConverter()
  let html = converter.makeHtml(markdown)
  let htmlToReactParser = new HtmlToReactParser(React)
  return htmlToReactParser.parse(html)
}
