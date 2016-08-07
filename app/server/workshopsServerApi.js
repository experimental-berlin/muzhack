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
let {connectToDb, closeDbConnection,} = require('./db')
let {requestHandler,} = require('./requestHandler')
let {createProject, updateProject, getProject, deleteProject,
  updateProjectFromGitHub,} = require('./api/projectApi')
let {trimWhitespace,} = require('../stringUtils')
let {getUserWithConn,} = require('./api/apiUtils')
let {badRequest,} = require('../errors')
let {notFoundError,} = require('../errors')

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
            return workshop
          } else {
            logger.debug(`Workshop '${workshopId}' wasn't found`)
            workshop = {
              id: 'ewajustka/voice-udder',
              title: 'Voice Odder Workshop',
              hostName: 'MS Stubnitz',
              hostAddress: 'Kirchenpauerkai, 20457 Hamburg, Germany',
              coverImageUrl: 'https://scontent.ftxl1-1.fna.fbcdn.net/v/t1.0-9/13508877_10201683647769183_4194719920633668303_n.jpg?oh=356e7b61b5caecda9d6339e54329884e&oe=585A1566',
              description: `“The word is now a virus. The flu virus may have once been a healthy lung cell. It is now a parasitic organism that invades and damages the central nervous system. Modern man has lost the option of silence. Try halting sub-vocal speech. Try to achieve even ten seconds of inner silence. You will encounter a resisting organism that forces you to talk. That organism is the word.” – William S. Burroughs, The Ticket That Exploded
<br><br>
During this workshop participants will free themselves of this “parasitic resisting organism” by building a device specially designed for this purpose. This device will allow the participants to hear the invader and even see him in the form of light. Do not be afraid though! This creature is not dangerous as we will keep it in the form of electronic circuitry where it will be drifting with currents and resistances. Let it speak through your voice, let's shout it out and modulate it ! We shall not be afraid of The Other!
<br><br>
///////////////////////////////////////////////////////////////////////////////////////////////////////
<br><br>
For this one-day workshop, Polish electronic noise artist Ewa Justka will guide you through the creation of a unique, multi-faceted electronic instrument and effects unit - The Voice Odder.
<br><br>
The Voice Odder is a simple electronic circuit based on delay IC. It can generate various sounds - from echo and delay effect to reverb, extreme resonance sampling and distortion, depending on resistance and voltage.
<br><br>
During the workshop participants will learn how to build electronic circuits: how to solder, read schematics and data sheets, use multimeter and what are the functions of basic electronic components.
<br><br>
The workshop is for beginners in electronics but advanced participants will have fun too!
<br><br>
All of the materials will be provided and are included in price. Participants will finish the workshop with their own fully-functioning Voice Odder to take away.
<br><br>
///////////////////////////////////////////////////////////////////////////////////////////////////////
<br>
DOCUMENTATION: https://ewajustka.bandcamp.com/album/voice-odder
<br><br>
PRICE: 25 EURO
<br><br>
MAX AMOUNT OF PARTICIPANTS: 15
<br><br>
TO BOOK A PLACE PLEASE EMAIL : ewajustka@gmail.com . YOU MUST PAY BEFOREHAND VIA PAYPAL IN ORDER TO BOOK THE PLACE.
<br><br>
PLEASE BRING WITH YOU A SOLDERING IRON IF YOU HAVE ONE.
<br><br>
THE WORKSHOP IS A PART OF THE PRIMAL UPROAR FESTIVAL.`,
              date: 'Friday, August 5, 2016',
            }
            return R.merge(workshop, {
              hostMapUrl: `https://www.google.com/maps/place/${workshop.hostAddress}`,
            })
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
