'use strict'
let logger = require('js-logger-aknudsen').get('workshopsServerApi')
let Boom = require('boom')
let R = require('ramda')
let S = require('underscore.string.fp')
let moment = require('moment')
let r = require('rethinkdb')
let JSZip = require('jszip')
let request = require('request')
let gcloud = require('gcloud')
let Promise = require('bluebird')

let stripeApi = require('./api/stripeApi')
let ajax = require('../ajax')
let {getEnvParam,} = require('./environment')
let {withDb, connectToDb, closeDbConnection,} = require('./db')
let {requestHandler,} = require('./requestHandler')
let {createProject, updateProject, getProject, deleteProject,
  updateProjectFromGitHub,} = require('./api/projectApi')
let {trimWhitespace,} = require('../stringUtils')
let {getUserWithConn,} = require('./api/apiUtils')
let {badRequest,} = require('../errors')

let search = (request, reply) => {
  logger.debug(`Searching for '${request.query.query}'`)
  withDb(reply, (conn) => {
    let reTag = /\[[^\]]*\]/g
    let queryWithoutTags = ''
    let tags = []
    let offset = 0
    let query = request.query.query
    while (true) {
      let m = reTag.exec(query)
      if (m == null) {
        break
      }

      let tag = trimWhitespace(m[0].slice(1, -1))
      logger.debug(`Found tag '${tag}'`)
      tags.push(tag.toLowerCase())
      queryWithoutTags += ' ' + query.slice(offset, m.index)
      offset = reTag.lastIndex
    }

    queryWithoutTags += ' ' + query.slice(offset)
    queryWithoutTags = trimWhitespace(queryWithoutTags.replace(/\s+/g, ' '))

    if (!S.isBlank(queryWithoutTags)) {
      logger.debug(`Tag-less query: '${queryWithoutTags}'`)
    } else {
      logger.debug(`Tag-less query is empty`)
    }
    if (!R.isEmpty(tags)) {
      logger.debug(`Tags:`, tags)
    } else {
      logger.debug(`No tags`)
    }
    let regex = `(?i)${queryWithoutTags}`
    return r.table('workshopLeaders')
      .orderBy({index: r.desc(`created`),})
      .filter((workshopLeader) => {
        let pred = workshopLeader('id').match(regex).or(workshopLeader('name').match(regex))
        R.forEach((tag) => {
          pred = pred.and(workshopLeader('tags').contains((t) => {return t.downcase().eq(tag)}))
        }, tags)
        return pred
      })
      .run(conn)
      .then((resultsCursor) => {
        return resultsCursor.toArray()
          .then((results) => {
            logger.debug(`Found ${results.length} result(s)`)
            return R.sort((a, b) => {
              return moment(b.created).diff(moment(a.created))
            }, results)
          }, (error) => {
            logger.warn(`Failed to search: '${error}'`, error.stack)
            throw new Error(error)
          })
      })
  })
}

module.exports.register = (server, standardVHost, workshopsVHost) => {
  let routeApiMethod = (options) => {
    options.path = `/api/workshops/${options.path}`
    server.route(R.merge(options, {
      vhost: [standardVHost, workshopsVHost,],
    }))
  }

  routeApiMethod({
    method: ['GET',],
    path: 'search',
    handler: search,
  })
}
