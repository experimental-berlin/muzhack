'use strict'
let logger = require('js-logger-aknudsen').get('displayProject')
let h = require('react-hyperscript')
let R = require('ramda')
let S = require('underscore.string.fp')
let component = require('omniscient')
let React = require('react')

let datetime = require('../../datetime')
let {nbsp,} = require('../../specialChars')
let {convertMarkdown,} = require('../../markdown')
let ajax = require('../../ajax')
let userManagement = require('../../userManagement')
let licenses = require('../../licenses')
let ProjectStore = require('./projectStore')

if (__IS_BROWSER__) {
  require('./displayProject.styl')
}

let getFileSize = (numBytes) => {
  let sizeStr
  if (numBytes < 1024) {
    sizeStr = `${numBytes} B`
  } else if (numBytes < 1024*1024) {
    sizeStr = `${Math.ceil(numBytes / 1024.0)} KB`
  } else if (numBytes < 1024*1024*1024) {
    sizeStr = `${Math.ceil(numBytes / (1024*1024.0))} MB`
  } else if (numBytes < 1024*1024*1024*1024) {
    sizeStr = `${Math.ceil(numBytes / (1024*1024*1024.0))} GB`
  } else {
    throw new Error(`File size too large: ${numBytes}`)
  }
  return sizeStr
}

let ProjectControls = component('ProjectControls', ({canEdit, project, cursor,}) => {
  return h('#project-controls', [
    canEdit ? h('a#edit-project-action.action', {
      href: `/u/${project.owner}/${project.projectId}/edit`, 'data-tooltip': 'Edit project',
    }, [h('span.icon-pencil3'),]) : null,
  ])
})

let TopPad = component('TopPad', (cursor) => {
  let projectCursor = cursor.cursor(['displayProject', 'project',])
  let project = projectCursor.toJS()
  let creationDateString = datetime.displayDateTextual(project.created)
  let mainPicture = project.chosenPicture || project.pictures[0]
  let loggedInUser = userManagement.getLoggedInUser(cursor)
  let canEdit = loggedInUser != null && loggedInUser.username === project.owner
  return h('#project-top-pad', [
    h('#project-top-elements', [
      h('#project-heading', [
        h('h1#project-title', project.title),
        h('p#project-creation-date', [
          `Added ${creationDateString} by `,
          h('a', {href: `/u/${project.owner}`,}, project.ownerName),
        ]),
      ]),
      ProjectControls({canEdit, project,}),
    ]),
    h('#image-box', [
      h('#thumbnails', R.map((picture) => {
        return h('a', {
          href: '#',
          onClick: (event) => {
            event.preventDefault()
            logger.debug(`Thumbnail clicked:`, picture)
            projectCursor.set('chosenPicture', picture)
          },
        }, [
          h('.thumbnail-wrapper', [
            h('img', {src: picture.url,}),
          ]),
        ])
      }, project.pictures)),
      h('#displayed-image', [
        h('img', {
          src: mainPicture != null ? mainPicture.url : null
        ,}),
      ]),
    ]),
  ])
})

let RightColumn = component('RightColumn', (project) => {
  let tagElems = R.chain((tag) => {
    return [h('a.project-tag', {
      href: '#',
      onClick: (event) => {
        logger.debug(`Project tag '${tag}' clicked`)
        event.preventDefault()
      },
    }, tag), ', ',]
  }, project.tags).slice(0, -1)
  return h('#right-column', [
    h('#tag-pad', [
      h('h2', [
        h('span.icon-tags2'),
        `${nbsp}Tags`,
      ]),
      h('#project-tags', tagElems),
    ]),
    h('#license-pad', [
      h('h2', 'License'),
      h('#license-icons', [
        h('a', {href: project.license.url, target: '_blank',}, R.map((icon) => {
          return h(`span.icon-${icon}`)
        }, project.license.icons)),
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

let BottomPad = component('BottomPad', ({cursor, project,}) => {
  let storeItems = project.storeItems || []
  logger.debug('Project has store items:', storeItems)
  let projectTabs = [
    new ProjectTab('Description', 'file-text'),
    new ProjectTab('Instructions', 'book'),
    new ProjectTab('Files', 'puzzle4'),
    new ProjectTab(`Store (${storeItems.length})`, 'credit-card', !R.isEmpty(storeItems)),
  ]
  let activeTab = cursor.cursor(['displayProject',]).get('activeTab')
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
    tabContent = ProjectFiles({project,})
  } else if (activeTab === 'store') {
    tabContent = ProjectStore({storeItems,})
  }
  return h('#project-bottom-pad', [
    h('ul.tabs', {role: 'tablist',}, R.map((projectTab) => {
      return h(`li.${S.join('.', projectTab.getClasses(cursor))}`, [
        h('a', {
          role: 'tab',
          href: '#',
          onClick: (event) => {
            event.preventDefault()

            if (projectTab.isEnabled && cursor.cursor(['displayProject',]).get('activeTab') !==
                projectTab.name) {
              logger.debug(`Switching project tab to '${projectTab.name}'`)
              cursor.cursor(['displayProject',]).set('activeTab', projectTab.name)
            }
          },
        }, [
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

let ProjectFiles = component('ProjectFiles', ({project,}) => {
  logger.debug(`Rendering files of project:`, project)
  if (R.isEmpty(project.files)) {
    return h('em', 'The project has no files')
  } else {
    let zipFileSize = project.zipFile != null ? getFileSize(project.zipFile.size) : 0
    return h('div', [
      h('a#download-zip-button.pure-button', {href: project.zipFile.url,}, [
        h('span.icon-file-zip'),
        `${nbsp}Download zip`,
        h('span.small', `${nbsp}(${zipFileSize})`),
      ]),
      h('table#project-files-table', [
        h('thead', [
          h('tr', [
            h('th', 'Filename'),
            h('th', 'Size'),
          ]),
        ]),
        h('tbody', R.map((file) => {
          let sizeStr = getFileSize(file.size)
          return h('tr', [
            h('td', [
              h('a', {href: file.url,}, [h('span.icon-puzzle4', `${nbsp}${file.fullPath}`),]),
            ]),
            h('td', [
              h('a', {href: file.url,}, sizeStr),
            ]),
          ])
        }, project.files)),
      ]),
    ])
  }
})

class ProjectTab {
  constructor (title, icon, isEnabled=true) {
    this.title = title
    this.icon = icon
    this.name = title.toLowerCase().replace(/ \(.+\)/, '')
    this.isEnabled = isEnabled
  }

  getClasses(cursor) {
    let activeTab = cursor.cursor(['displayProject',]).get('activeTab')
    let classes = []
    if (activeTab === this.name) {
      logger.debug(`${this.name} is active tab`)
      classes.push('active')
    }
    if (!this.isEnabled) {
      classes.push('disabled')
    }
    return classes
  }
}

let render = (cursor) => {
  let projectCursor = cursor.cursor(['displayProject', 'project',])
  let project = projectCursor.toJS()

  logger.debug(`Rendering display of project:`, project)
  return h('div', [
    h('h1#project-path', `${project.owner} / ${project.projectId}`),
    TopPad(cursor),
    RightColumn(project),
    BottomPad({cursor, project,}),
  ])
}

module.exports = {
  render: render,
  loadData: (cursor, params) => {
    let {owner, projectId,} = params
    if (owner == null) {
      throw new Error(`Owner is undefined`)
    }
    if (projectId == null) {
      throw new Error(`Project ID is undefined`)
    }
    logger.debug(`Loading project ${params.owner}/${params.projectId}`)
    return ajax.getJson(`/api/projects/${params.owner}/${params.projectId}`)
      .then((project) => {
        logger.debug(`Loading project JSON succeeded:`, project)
        return {
          displayProject: {
            activeTab: 'description',
            project: R.merge(project, {
              license: licenses[project.licenseId],
            }),
          },
        }
      }, (error) => {
        logger.warn(`Loading project JSON failed: '${error}:'`, error.stack)
        throw new Error(error)
      })
  },
}
