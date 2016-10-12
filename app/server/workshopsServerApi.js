'use strict'
let logger = require('@arve.knudsen/js-logger').get('workshopsServerApi')
let Boom = require('boom')
let R = require('ramda')
let S = require('underscore.string.fp')
let moment = require('moment')
let r = require('rethinkdb')
let request = require('request')
let Promise = require('bluebird')

let {connectToDb, closeDbConnection,} = require('./db')
let {trimWhitespace,} = require('../stringUtils')
let {notFoundError,} = require('../errors')
let {convertMarkdownToHtml,} = require('../markdown')

let search = (request) => {
  logger.debug(`Searching for '${request.query.query}'`)
  return connectToDb()
    .then((conn) => {
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
      return r.table('users')
        .orderBy({index: r.desc(`created`),})
        .filter((user) => {
          let pred = user('isWorkshopLeader').and(
            user('id').match(regex).or(user('name').match(regex))
          )
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
        .finally(() => {
          closeDbConnection(conn)
        })
    })
}

let getWorkshop = (request) => {
  let workshopId = request.params.id
  return connectToDb()
    .then((conn) => {
      return r.table('workshops')
        .get(workshopId)
        .run(conn)
        .then((workshop) => {
          if (workshop != null) {
            return R.merge(workshop, {
              description: convertMarkdownToHtml(workshop.description),
              host: {
                id: workshop.host.id,
                name: workshop.host.name,
                address: workshop.host.address,
                mapUrl: `https://www.google.com/maps/place/${workshop.host.address}`,
              },
            })
          } else {
            logger.debug(`Workshop '${workshopId}' wasn't found`)
            throw notFoundError()
          }
        })
        .finally(() => {
          closeDbConnection(conn)
        })
    })
}

module.exports.register = (server, standardVHost, workshopsVHost) => {
  let routeApiMethod = (options) => {
    options.path = `/api/workshops/${options.path}`
    if (typeof options.handler === 'function') {
      let origHandler = options.handler
      options.handler = (request, reply) => {
        Promise.method(origHandler)(request)
          .then((result) => {
            logger.debug(`Request handler returned result:`, result)
            reply(result)
          }, (error) => {
            if (error.type === 'notFound') {
              reply(Boom.notFound())
            } else {
              logger.error(`An uncaught exception occurred:`, error)
              reply(Boom.badImplementation())
            }
          })
      }
    }
    server.route(R.merge({
      method: 'GET',
      vhost: [standardVHost, workshopsVHost,],
    }, options))
  }

  routeApiMethod({
    path: 'search',
    handler: search,
  })
  routeApiMethod({
    path: 'workshops/{id}',
    handler: getWorkshop,
  })
}
