'use strict'
let logger = require('js-logger-aknudsen').get('project.loadData')

let ajax = require('../../ajax')

module.exports = (cursor, params) => {
  logger.debug(`Loading project ${params.owner}/${params.projectId}`)
  return ajax.getJson(`/api/projects/${params.owner}/${params.projectId}`)
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
  }
