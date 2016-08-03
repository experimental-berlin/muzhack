'use strict'
let logger = require('js-logger-aknudsen').get('displayProject')
let h = require('react-hyperscript')
let R = require('ramda')
let S = require('underscore.string.fp')
let component = require('omniscient')
let React = require('react')
let ReactDOM = require('react-dom')

let datetime = require('../../datetime')
let {nbsp,} = require('../../specialChars')
let {convertMarkdown,} = require('../../markdown')
let ajax = require('../../ajax')
let userManagement = require('../../userManagement')
let licenses = require('../../licenses')
let ProjectStore = require('./projectStore')
let {trimWhitespace,} = require('../../stringUtils')
let {goTo,} = require('../../router')

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
  let hasStoreItems = !R.isEmpty(project.storeItems || [])
  return h('#project-controls', [
    hasStoreItems ? GoToStore(cursor) : null,
    canEdit ? h('a#edit-project-action.action', {
      href: `/u/${project.owner}/${project.projectId}/edit`, 'data-tooltip': 'Edit project',
    }, [h('span.icon-pencil3'),]) : null,
  ])
})

let GoToStore = component('GoToStore', (cursor) => {
  return h('#go-to-store.action', {
    onClick: () => {
      logger.debug(`Go to store clicked`)
      cursor = cursor.mergeDeep({
        displayProject: {
          goToStore: true,
          activeTab: 'store',
        },
      })
    },
  }, [
    h('span.icon-barcode'),
  ])
})

let FacebookLike = component('FacebookLike', {
  componentDidMount: () => {
    logger.debug(`Loading Facebook social SDK`)

    FB.XFBML.parse()
  },
}, (cursor) => {
  let projectCursor = cursor.cursor(['displayProject', 'project',])
  let owner = projectCursor.get(`owner`)
  let projectId = projectCursor.get(`projectId`)
  let pageUrl = `${cursor.get('appUri')}/u/${owner}/${projectId}`
  logger.debug(`Generating like button for project page '${pageUrl}'`)
  return h('.fb-like', {
    'data-href': pageUrl,
    'data-layout': 'standard',
    'data-action': 'like',
    'data-show-faces': 'true',
    'data-share': 'true',
  })
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
      ProjectControls({canEdit, project, cursor,}),
    ]),
    h('#image-box', [
      h('#thumbnails', R.map((picture) => {
        return h('.thumbnail-wrapper', {
          onClick: (event) => {
            event.preventDefault()
            logger.debug(`Thumbnail clicked:`, picture)
            projectCursor.set('chosenPicture', picture)
          },
        }, [
          h('img', {src: picture.thumbNailUrl,}),
        ])
      }, project.pictures)),
      h('#displayed-image', [
        h('img', {
          src: mainPicture != null ? mainPicture.mainUrl : null
        ,}),
      ]),
    ]),
    h('#social-controls', [
      FacebookLike(cursor),
    ]),
  ])
})

let RightColumn = component('RightColumn', ({project, cursor,}) => {
  let tagElems = R.chain((tag) => {
    let searchString = `[${tag}]`
    return [h('a.project-tag', {
      href: `/?q=${encodeURIComponent(searchString)}`,
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

let renderInstructions = (cursor, project) => {
  let instructions = convertMarkdown(project.instructions)
  let displayProjectCursor = cursor.cursor('displayProject')
  if (project.bomMarkdown != null) {
    let expandBillOfMaterials = displayProjectCursor.get('expandBillOfMaterials')
    let visibilityIcon = expandBillOfMaterials ? `icon-arrow-down14` : `icon-arrow-right14`
    let billOfMaterialsOptions = {}
    if (!expandBillOfMaterials) {
      billOfMaterialsOptions['hidden'] = 'hidden'
    }
    return h('div', [
      project.instructionsPdfUrl != null ? h('div', [
        h('a.action', {href: project.instructionsPdfUrl,}, h('span.icon-file-pdf')),
        h('hr'),
      ]) : null,
      h('h1#bill-of-materials-header', 'Bill of Materials'),
      nbsp,
      h(`span#control-bom-visibility.action.${visibilityIcon}`, {
        onClick: () => {
          let showBillOfMaterials = !expandBillOfMaterials
          if (showBillOfMaterials) {
            logger.debug(`Expanding bill of materials`)
          } else {
            logger.debug(`Folding bill of materials`)
          }
          displayProjectCursor.set(`expandBillOfMaterials`, showBillOfMaterials)
        },
      }),
      h('#bill-of-materials', billOfMaterialsOptions, [
        convertMarkdown(project.bomMarkdown),
      ]),
      h('hr'),
      h('#instructions-container', [
        instructions,
      ]),
    ])
  } else {
    return h('#instructions-container', [
      instructions,
    ])
  }
}

let BottomPad = component('BottomPad',
  {
    componentDidUpdate: function () {
      let node = ReactDOM.findDOMNode(this)
      let cursor = this.props.cursor
      let activeTab = cursor.cursor(['projectStore',]).get('activeTab')
      if (cursor.cursor('displayProject').get('goToStore')) {
        let domNode = ReactDOM.findDOMNode(this)
        logger.debug(`Scrolling bottom pad into view`)
        domNode.scrollIntoView({behavior: 'smooth',})
        cursor.cursor('displayProject').set('goToStore', false)
      }
    },
  }, ({cursor, project,}) => {
    let partsPurchaseSection = null
    if (project.mouserProject != null) {
      partsPurchaseSection = h('#parts-purchase-section', [
        h('h1', 'Purchase Parts'),
        h('a.pure-button', {
          href: `https://eu.mouser.com/ProjectManager/ProjectDetail.aspx?AccessID=${project.mouserProject}`,
          target: `_blank`,
        }, 'Buy from Mouser'),
      ])
    }
    let storeItems = project.storeItems || []
    logger.debug('Project has store items:', storeItems)
    let projectTabs = [
      new ProjectTab('Description', 'file-text'),
      new ProjectTab('Instructions', 'book'),
      new ProjectTab('Files', 'puzzle4'),
      new ProjectTab(`Store (${storeItems.length})`, 'barcode', !R.isEmpty(storeItems)),
    ]
    let activeTab = getActiveTab(cursor)
    let tabContent
    if (activeTab === 'description') {
      tabContent = h('#description', [
        convertMarkdown(project.description),
      ])
    } else if (activeTab === 'instructions') {
      tabContent = h('#instructions', [
        partsPurchaseSection,
        renderInstructions(cursor, project),
      ])
    } else if (activeTab === 'files') {
      tabContent = ProjectFiles({project,})
    } else if (activeTab === 'store') {
      tabContent = ProjectStore({project, storeItems, cursor,})
    }
    return h('#project-bottom-pad', [
      h('ul.tabs', {role: 'tablist',}, R.map((projectTab) => {
        return h(`li.${S.join('.', projectTab.getClasses(cursor))}`, [
          h('div', {
            role: 'tab',
            onClick: (event) => {
              event.preventDefault()

              let activeTab = getActiveTab(cursor)
              if (projectTab.isEnabled && activeTab !== projectTab.name) {
                logger.debug(`Switching project tab to '${projectTab.name}'`)
                goTo(`#${projectTab.name}`)
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

let getActiveTab = (cursor) => {
  let activeTab = cursor.getIn([`router`, `currentHash`,])
  if (S.isBlank(activeTab)) {
    activeTab = 'description'
  }
  return activeTab
}

class ProjectTab {
  constructor (title, icon, isEnabled=true) {
    this.title = title
    this.icon = icon
    this.name = title.toLowerCase().replace(/ \(.+\)/, '')
    this.isEnabled = isEnabled
  }
  getClasses(cursor) {
    let activeTab = getActiveTab(cursor)
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

  // logger.debug(`Rendering display of project:`, project)
  return h('div', [
    h('h1#project-path', `${project.owner} / ${project.projectId}`),
    TopPad(cursor),
    RightColumn({cursor, project,}),
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

    let qualifiedProjectId = `${params.owner}/${params.projectId}`
    logger.debug(`Loading project ${qualifiedProjectId}...`)
    return ajax.getJson(`/api/projects/${params.owner}/${params.projectId}`)
      .then((project) => {
        logger.debug(`Loading project ${qualifiedProjectId} JSON succeeded`)
        let chosenPicture = project.chosenPicture || project.pictures[0]
        return {
          metaHtmlAttributes: [
            {property: 'fb:app_id', content: cursor.get('fbAppId'),},
            {property: 'og:title', content: project.title,},
            {property: 'og:type', content: 'website',},
            {property: 'og:image', content: chosenPicture.mainUrl,},
            {property: 'og:description', content: project.summary || '',},
          ],
          displayProject: {
            expandBillOfMaterials: true,
            project: R.merge(project, {
              license: licenses[project.licenseId],
            }),
          },
        }
      }, (error) => {
        logger.warn(`Loading project ${qualifiedProjectId} JSON failed:`, error)
        throw error
      })
  },
}
