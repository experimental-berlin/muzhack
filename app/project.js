'use strict'
let logger = require('js-logger').get('project')
let h = require('react-hyperscript')
let R = require('ramda')
let S = require('underscore.string.fp')
let component = require('omniscient')
let React = require('react')
let HtmlToReactParser = require('html-to-react/lib/parser')
let {getSanitizingConverter,} = require('./pagedown/Markdown.Sanitizer')

let datetime = require('./datetime')
let ajax = require('./ajax')
let {nbsp,} = require('./specialChars')

let getFileSize = (numBytes) => {
  if (numBytes < 1024) {
    sizeStr = '#{numBytes} B'
  } else if (numBytes < 1024*1024) {
    sizeStr = '#{Math.ceil(numBytes / 1024.0)} KB'
  } else if (numBytes < 1024*1024*1024) {
    sizeStr = '#{Math.ceil(numBytes / (1024*1024.0))} MB'
  } else if (numBytes < 1024*1024*1024*1024) {
    sizeStr = '#{Math.ceil(numBytes / (1024*1024*1024.0))} GB'
  } else {
    throw new Error('File size too large: #{numBytes}')
  }
  return sizeStr
}

let TopPad = component('TopPad', (project) => {
  let canEdit = false
  let creationDateString = datetime.displayDateTextual(project.created)
  let mainPicture = null
  return h('#project-top-pad.airy-padding-sides', [
    h('#project-heading', [
      h('h1#project-title', project.title),
      h('p#project-creation-date', [
        `Added ${creationDateString} by `,
        h('a', {href: `/u/${project.owner}`,}, project.ownerName),
      ]),
    ]),
    h('#image-box', [
      h('#thumbnails', R.map((picture) => {
        return h(a, {href: '#',}, [
          h('.thumbnail-wrapper', [
            h('img', {src: picture.url,}),
          ]),
        ])
      }, project.pictures)),
      h('#displayed-image', [
        h('img', {src: mainPicture,}),
      ]),
    ]),
  ])
})

let RightColumn = component('RightColumn', (project) => {
  let tagsString = ''
  return h('#right-column', [
    h('#tag-pad.airy-padding-sides', [
      h('h2', [
        h('span.icon-tags2'),
        `${nbsp}Tags`,
      ]),
      h('#project-tags', [
        tagsString,
      ]),
    ]),
    h('#license-pad.airy-padding-sides', [
      h('h2', 'License'),
      h('#license-icons', [
        h('a', {href: project.license.url, target: '_blank',}, R.map((icon) => {
          return h(`span.icon-${icon}`)
        })),
      ]),
      h('p', [
        h('strong', [
          `${project.title} is licensed under the `,
          h('a', {href: project.license.url, target: '_blank',}, project.license.name),
          ' license.',
        ]),
      ]),
    ]),
  ])
})

let convertMarkdown = (markdown) => {
  let converter = getSanitizingConverter()
  let html = converter.makeHtml(markdown)
  let htmlToReactParser = new HtmlToReactParser(React)
  return htmlToReactParser.parse(html)
}

let BottomPad = component('BottomPad', ({cursor, project,}) => {
  let projectTabs = [
    new ProjectTab('Description', 'file-text'),
    new ProjectTab('Instructions', 'book'),
    new ProjectTab('Files', 'puzzle4'),
  ]
  let activeTab = cursor.cursor(['explore', 'project',]).get('activeTab')
  let tabContent
  if (activeTab === 'description') {
    tabContent = h('#description', [
      convertMarkdown(project.description),
    ])
  } else if (activeTab === 'instructions') {
    tabContent = h('#instructions', [
      convertMarkdown(project.instructions),
    ])
  } else if (activeTab === 'files') {
    tabContent = ProjectFiles(cursor)
  }
  return h('#project-bottom-pad', [
    h('ul.tabs', {role: 'tablist',}, R.map((projectTab) => {
      return h(`li.${S.join('.', projectTab.getClasses(cursor))}`, [
        h('a', {role: 'tab', href: project.title.toLowerCase(),}, [
          projectTab.icon != null ? h(`span.icon-${projectTab.icon}`, nbsp) : null,
          projectTab.title,
       ]),
     ])
    }, projectTabs)),
    h('#tab-contents', [
      tabContent,
    ]),
  ])
})

let ProjectFiles = component('ProjectFiles', (project) => {
  if (R.isEmpty(project.files)) {
    return h('em', 'The project has no files')
  } else {
    let zipFileSize = project.zipFile != null ? getFileSize(project.zipFile.size) : 0
    return [
      h('a#download-zip-button.pure-button', {href: project.zipFile.url,}, [
        h('span.icon-file-zip', [
          'Download zip',
          h('span.small', `(${zipFileSize})`),
        ]),
      ]),
      h('table#project-files-table', [
        h('thead', [
          h('tr', [
            h('th', 'Filename'),
            h('th', 'Size'),
          ]),
        ]),
        h('tbody', R.map((file) => {
          return h('tr', [
            h('td', [
              h('a', {href: url,}, [h('span.icon-puzzle4', `${nbsp}${file.fullPath}`),]),
            ]),
            h('td', [
              h('a', {href: url,}, sizeStr),
            ]),
          ])
        }, project.files)),
      ]),
    ]
  }
})

class ProjectTab {
  constructor (title, icon) {
    this.title = title
    this.icon = icon
    this.name = title.toLowerCase()
  }

  getClasses(cursor) {
    let activeTab = cursor.cursor(['explore', 'project',]).get('activeTab')
    if (activeTab === this.name) {
      logger.debug(`${this.name} is active tab`)
      return ['active',]
    } else {
      return []
    }
  }
}

let render = (cursor) => {
  let project = cursor.cursor('explore').get('currentProject').toJS()
  logger.debug(`Rendering project`, project)
  let qualifiedProjectId = `${project.owner}/${project.projectId}`
  return h('.airy-padding-sides', [
    h('h1#project-path', qualifiedProjectId),
    TopPad(project),
    RightColumn(project),
    BottomPad({cursor, project,}),
 ])
}

module.exports = {
  routeOptions: {
    render: render,
    loadData: (cursor, params) => {
      logger.debug(`Loading project ${params.owner}/${params.projectId}`)
      return ajax.getJson(`projects/${params.owner}/${params.projectId}`)
        .then((project) => {
          logger.debug(`Loading project JSON succeeded:`, project)
          return {
            explore: {
              currentProject: project,
              project: {
                activeTab: 'description',
              },
            },
          }
        }, (reason) => {
          logger.warn(`Loading project JSON failed: '${reason}'`)
        })
    },
  },
}
