'use strict'
let HtmlToReactParser = require('../lib/html-to-react/lib/parser')
let React = require('react')
let {getSanitizingConverter,} = require('../lib/pagedown/Markdown.Sanitizer')
let logger = require('js-logger-aknudsen').get('markdown')
let $ = require('jquery')
let R = require('ramda')

let editing = require('./editing')

module.exports.convertMarkdown = (markdown) => {
  let converter = getSanitizingConverter()
  let html = converter.makeHtml(markdown || '')
  let htmlToReactParser = new HtmlToReactParser(React)
  // Enclose in a div since HtmlToReact can't handle multiple root elements
  return htmlToReactParser.parse(`<div>${html}</div>`)
}

let markdownManual = {
  Links: `<p>In most cases, a plain URL will be recognized as such and automatically linked:<p>
<pre>Visit https://twitter.com/muzhack/ for the latest news.
Use angle brackets to force linking: I frequent &lt;http://forums.muzhack.com&gt; daily.</pre>
<p>To create fancier links, use Markdown:</p>
<pre>Here's [a link](http://www.example.com/)! And a reference-style link to [a panda][1].
References don't have to be [numbers][about].

[1]: http://notfound.example.com/
[about]: http://muzhack.com/about</pre>
<p>You can add tooltips to links:</p>
<pre>
Click [here](http://muzhack.com<span class='spaces'>&nbsp;</span>'this text appears when you mouse over')!
This works with [reference links][blog] as well.

[blog]: http://arveknudsen.com/<span class='spaces'>&nbsp;</span>'click here for updates'</pre>
`,
  Images: `<p>Images are exactly like links, but they have an exclamation point in front of them:
</p>
<pre>
![bowsense!](http://www.notam02.no/web/wp-content/gallery/bowsense/07_hypersaxophone.jpg)
![bowsense][1]

 [1]: http://www.notam02.no/web/wp-content/gallery/bowsense/07_hypersaxophone.jpg 'tooltip'</pre>
<p>
The word in square brackets is the alt text, which gets displayed if the browser can't show the
image. Be sure to include meaningful alt text for screen-reading software.
</p>
`,
  'Styling/Headers': `<div class='col-container'>
  <div class='col1'>
    <p>Be sure to use text styling sparingly; only where it helps readability.</p>
    <pre>
*This is italicized*, and so
is _this_.

**This is bold**, just like __this__.

You can ***combine*** them
if you ___really have to___.</pre>
  </div>
  <div class='col2'>
    <p>To break your text into sections, you can use headers:</p>
    <pre>A Large Header
==============

Smaller Subheader
-----------------</pre>
  <p>Use hash marks if you need several levels of headers:</p>
  <pre>
# Header 1 #
## Header 2 ##
### Header 3 ###</pre>
  </div>
</div>
`,
  Lists: `<p>Both bulleted and numbered lists are possible:</p>
<div class='col-container'>
  <div class='col1'>
    <pre>-<span class='spaces'>&nbsp;</span>Use a minus sign for a bullet
+<span class='spaces'>&nbsp;</span>Or a plus sign
*<span class='spaces'>&nbsp;</span>Or an asterisk

1.<span class='spaces'>&nbsp;</span>Numbered lists are easy
2.<span class='spaces'>&nbsp;</span>Markdown keeps track of
 the numbers for you
7.<span class='spaces'>&nbsp;</span>So this will be item 3.</pre>
  </div>
  <div class='col2'>
    <pre>1.<span class='spaces'>&nbsp;</span>Lists in a list item:
<span class='spaces'>&nbsp;&nbsp;&nbsp;&nbsp;</span>-<span class='spaces'>&nbsp;</span>Indented four spaces.
<span class='spaces'>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span>*<span class='spaces'>&nbsp;</span>indented eight spaces.
<span class='spaces'>&nbsp;&nbsp;&nbsp;&nbsp;</span>-<span class='spaces'>&nbsp;</span>Four spaces again.
2.<span class='spaces'>&nbsp;&nbsp;</span>You can have multiple
<span class='spaces'>&nbsp;&nbsp;&nbsp;&nbsp;</span>paragraphs in a list items.
<span class='spaces'>&nbsp;</span>
<span class='spaces'>&nbsp;&nbsp;&nbsp;&nbsp;</span>Just be sure to indent.</pre>
  </div>
</div>
`,
  Blockquotes: `<div class='col-container'>
  <div class='col1'>
    <pre>> Create a blockquote by
> prepending “>” to each line.
>
> Other formatting also works here, e.g.
>
> 1. Lists or
> 2. Headings:
>
> ## Quoted Heading ##</pre>
  </div>
  <div class='col2'>
    <p>You can even put blockquotes in blockquotes:</p>
    <pre>> A standard blockquote is indented
> > A nested blockquote is indented more
> > > > You can nest to any depth.</pre>
  </div>
</div>
`,
  Code: `<p>To create code blocks or other preformatted text, indent by four spaces:</p>
<pre>
<span class='spaces'>&nbsp;&nbsp;&nbsp;&nbsp;</span>This will be displayed in a monospaced font. The first four spaces
<span class='spaces'>&nbsp;&nbsp;&nbsp;&nbsp;</span>will be stripped off, but all other whitespace will be preserved.
<span class='spaces'>&nbsp;&nbsp;&nbsp;&nbsp;</span>
<span class='spaces'>&nbsp;&nbsp;&nbsp;&nbsp;</span>Markdown and HTML are turned off in code blocks:
<span class='spaces'>&nbsp;&nbsp;&nbsp;&nbsp;</span>&lt;i&gt;This is not italic&lt;/i&gt;, and [this is not a link](http://example.com)
</pre>
<p>To create not a block, but an inline code span, use backticks:</p>
<pre>
git clone git@github.com:muzhack/muzhack.git.
</pre>
<p>If you want to have a preformatted block within a list, indent by eight spaces:</p>
<pre>
1. This is normal text.
2. So is this, but now follows a code block:
<span class='spaces'>&nbsp;</span>
<span class='spaces'>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span>Skip a line and indent eight spaces.
<span class='spaces'>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span>That's four spaces for the list
<span class='spaces'>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span>and four to trigger the code block.
</pre>
`,
  HTML: `<p>If you need to do something that Markdown can't handle, use HTML. Note that we only
support a very strict subset of HTML!</p>
<pre>
Building synths is &lt;strike&gt;fun&lt;/strike&gt;.
</pre>
<p>Markdown is smart enough not to mangle your span-level HTML:</p>
<pre>
&lt;b&gt;Markdown works *fine* in here.&lt;/b&gt;
</pre>
<p>Block-level HTML elements have a few restrictions:</p>
<ol>
<li>They must be separated from surrounding text by blank lines.</li>
<li>The begin and end tags of the outermost block element must not be indented.</li>
<li>Markdown can't be used within HTML blocks.</li>
</ol>

<pre>
&lt;pre&gt;
 You can &lt;em&gt;not&lt/em&gt; use Markdown in here.
&lt;/pre&gt;
</pre>
`,
}

let markdownOptions = {
  icons: {
    bold: 'bold',
    italic: 'italic',
    link: 'link',
    quote: 'quotes-left',
    code: 'code',
    image: 'image2',
    olist: 'list-numbered',
    ulist: 'list2',
    heading: 'header',
    hr: 'ruler',
    undo: 'undo',
    redo: 'redo',
    help: 'question',
  },
}

class Editor {
  constructor(converter, purpose) {
    let MarkdownEditor = require('../lib/pagedown/Markdown.Editor').Editor
    this.purpose = purpose
    this.markdownEditor = new MarkdownEditor(converter, `-${purpose}`,
      R.merge(markdownOptions, {helpButton: {
        handler: () => {
          logger.debug('Toggling display of Markdown help')
          if ($(this._helpContainer).height() === 0) {
            logger.debug('Showing help')
            this._resizeHelp()
          } else {
            logger.debug('Hiding help')
            this._helpContainer.style.height = 0
            this._helpContentContainer.style.height = 0
            this._selectedHelpItem = null
          }
        },
      },}))
  }

  render(text) {
    let createHelpContainer = (className) => {
      let container = document.createElement('div')
      container.classList.add(className)
      container.style['box-sizing'] = 'border-box'
      container.style.height = '0'
      container.style.overflow = 'hidden'
      container.style['max-height'] = '9999px'
      return container
    }

    this._selectedHelpItem = null
    this.markdownEditor.render(text)
    this.markdownEditor.hooks.set('onChange', editing.onChange)

    let helpRowId = `wmd-help-row-${this.purpose}`
    let helpId = `wmd-help-${this.purpose}`
    let buttonBar = document.getElementById(`wmd-button-bar-${this.purpose}`)
    if (buttonBar == null) {
      throw new Error(`Element with ID 'wmd-button-bar-${this.purpose}' not found`)
    }

    this._helpContainer = createHelpContainer('wmd-help-container')
    let helpRow = document.createElement('div')
    helpRow.id = helpRowId
    helpRow.classList.add('wmd-help-row')
    helpRow.style['box-sizing'] = 'border-box'
    let helpList = document.createElement('ul')
    helpList.style.padding = 0
    helpList.style.margin = 0
    helpRow.appendChild(helpList)

    let toggleHelpItem = (topic, item) => {
      logger.debug(`Help item clicked: '${topic}'`)
      if (this._selectedHelpItem != null) {
        this._selectedHelpItem.classList.remove('selected')
        if (this._selectedHelpItem === item) {
          logger.debug('Just closing selected help item')
          this._helpContentContainer.style.height = 0
          this._selectedHelpItem = null
          this._resizeHelp()
          return
        }
      } else {
        logger.debug('No previously selected help item')
      }

      item.classList.add('selected')
      this._helpContentContainer.style.height = 'auto'
      this._helpContent.innerHTML = markdownManual[topic]
      this._selectedHelpItem = item
      this._resizeHelp()
    }

    R.forEach((topic) => {
      let helpItem = document.createElement('li')
      helpItem.classList.add('wmd-help-item')
      helpItem.style['list-style'] = 'none'
      helpItem.style.padding = '6px'
      helpItem.style.display = 'inline-block'
      helpItem.style['margin-right'] = '8px'
      let helpItemLink = document.createElement('a')
      helpItemLink.setAttribute('href', '#')
      helpItemLink.classList.add('wmd-help-item-link')
      helpItemLink.style['text-decoration'] = 'none'
      helpItemLink.style.color = 'black'
      helpItemLink.appendChild(document.createTextNode(topic))
      helpItemLink.onclick = R.partial(toggleHelpItem, [topic, helpItem,])
      helpItem.appendChild(helpItemLink)
      helpList.appendChild(helpItem)
    }, ['Links', 'Images', 'Styling/Headers', 'Lists', 'Blockquotes', 'Code', 'HTML',])

    this._helpContainer.appendChild(helpRow)

    this._helpContentContainer = createHelpContainer('wmd-help-content-container')
    this._helpContent = document.createElement('div')
    this._helpContent.id = helpId
    this._helpContent.classList.add('wmd-help-content')
    this._helpContentContainer.appendChild(this._helpContent)
    this._helpContainer.appendChild(this._helpContentContainer)

    buttonBar.appendChild(this._helpContainer)
  }

  getText() {
    return this.markdownEditor.getText()
  }

  _resizeHelp() {
    let $clone = $(this._helpContainer).clone()
      .css({position: 'absolute', visibility: 'hidden', height: 'auto',})
      .appendTo('body')
    let height = $clone.height()
    $clone.remove()
    this._helpContainer.style.height = `${height}px`
  }
}

class MarkdownService {
  constructor() {
    let converter = getSanitizingConverter()
    logger.debug('Instantiating editors')
    this.descriptionEditor = new Editor(converter, 'description')
    this.instructionsEditor = new Editor(converter, 'instructions')
  }

  getDescription() {
    return this.descriptionEditor.getText()
  }

  getInstructions() {
    return this.instructionsEditor.getText()
  }

  renderDescriptionEditor(text) {
    logger.debug('Resetting description editor')
    this.descriptionEditor.render(text)
  }

  renderInstructionsEditor(text) {
    logger.debug('Resetting instructions editor')
    this.instructionsEditor.render(text)
  }
}

if (__IS_BROWSER__) {
  module.exports.markdownService = new MarkdownService()
}
