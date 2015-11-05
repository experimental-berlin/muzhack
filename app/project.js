'use strict'
let logger = require('js-logger').get('project')
let h = require('react-hyperscript')
let R = require('ramda')

let datetime = require('./datetime')
let ajax = require('./ajax')

let render = (cursor) => {
  let project = cursor.cursor('explore').get('currentProject').toJS()
  let qualifiedProjectId = `${project.owner}/${project.projectId}`
  let canEdit = false
  let creationDateString = datetime.displayDateTextual(project.created)
  let mainPicture = null
  let tagsString = ''
  logger.debug(`Rendering project`, project)
  return h('.airy-padding-sides', [
    h('h1#project-path', qualifiedProjectId),
    h('#project-top-pad.airy-padding-sides', [
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
    ]),
    h('#right-column', [
      h('#tag-pad.airy-padding-sides', [
        h('h2', [
          h('span.icon-tags2', '&nbsp;Tags'),
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
    ]),
  ])

  // #project-top-pad.airy-padding-sides
  //   if canEdit
  //     a#edit-action.action.pull-right(href="#", data-tooltip="Edit project")
  //       span.icon-pencil3
  //   #project-heading
  //     h1#project-title
  //       = title
  //     p#project-creation-date Added #{creationDateString} by #[a(href="/u/#{username}") #{userFullName})
  //   #image-box
  //     #thumbnails
  //       each pictures
  //         a(href="#")
  //           .thumbnail-wrapper
  //             img(src="#{url}")
  //     #displayed-image
  //       img(src="#{mainPicture}")
  // #right-column
  //   #tag-pad.airy-padding-sides
  //     h2
  //       span.icon-tags2 &nbsp;Tags
  //     #project-tags
  //       != tagsString
  //   #license-pad.airy-padding-sides
  //     h2 License
  //     #license-icons
  //       a(href="#{license.url}" target="_blank")
  //         each license.icons
  //           span(class="icon-#{this}")
  //     p
  //       strong #{title}
  //       | is licensed under the
  //       a(href="#{license.url}" target="_blank") #{license.name}
  //       | license.
  //
  // #project-bottom-pad
  //   ul.tabs(role="tablist")
  //     each projectTabs
  //       li(class="#{classes}")
  //         a(role="tab" href="##{title.toLowerCase}")
  //           if icon
  //             span(class="icon-#{icon}") &nbsp;
  //           = title
  //   #tab-contents
  //     if displayDescription
  //       #description
  //         +markdown
  //           #{description}
  //     if displayInstructions
  //       #instructions
  //         +markdown
  //           #{instructions}
  //     if displayFiles
  //       +projectFiles

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
            },
          }
        }, (reason) => {
          logger.warn(`Loading project JSON failed: '${reason}'`)
        })
    },
  },
}
