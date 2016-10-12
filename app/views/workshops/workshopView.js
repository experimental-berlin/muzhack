'use strict'
let component = require('omniscient')
let R = require('ramda')
let S = require('underscore.string.fp')
let h = require('react-hyperscript')
let immutable = require('immutable')
let logger = require('@arve.knudsen/js-logger').get('workshopView')
let moment = require('moment')

let ajax = require('../../ajax')
let {nbsp,} = require('../../specialChars')
let {convertHtmlToReact,} = require('../../markdown')
let VCard = require('./workshopsVCard')
let {partitionWorkshops,} = require('../workshopsCommon')
let {displayDateTextual,} = require('../../datetime')

if (__IS_BROWSER__) {
  require('./workshopView.styl')
}

module.exports = {
  createState: () => {
    return immutable.fromJS({
    })
  },
  loadData: (cursor, params) => {
    logger.debug(`Loading from /api/workshops/${params.workshop}`)
    return ajax.getJson(`/api/workshops/workshops/${params.workshop}`)
      .then((workshop) => {
        logger.debug(`Loading workshop JSON succeeded:`, workshop)
        return {
          workshopView: {
            workshop,
          },
        }
      }, (error) => {
        logger.warn(`Loading workshop JSON failed:`, error)
        throw error
      })
  },
  render: (cursor) => {
    let state = cursor.cursor('workshopView').toJS()
    let {workshop,} = state
    logger.debug(`Rendering workshop '${workshop.id}':`, workshop)
    logger.debug(`State:`, state)
    let startTime = moment(workshop.startTime).utc()

    return h('#workshop-pad', [
      h('.pure-g', [
        h('.pure-u-1', [
          h('#workshop-cover-wrapper', [
            h('img#workshop-cover-image', {
              src: workshop.coverImageUrl,
            }),
          ]),
          h('h1#workshop-title', workshop.title),
          h('#workshop-date-container', [
            h('span.icon-clock'),
            nbsp,
            h('#workshop-date', displayDateTextual(startTime)),
          ]),
          h('#workshop-host-name-and-address-container', [
            h('span.icon-location'),
            nbsp,
            h('#workshop-host-name-and-address', [
              workshop.host.id != null ?
                h('a#workshop-host-name', {href: `/h/${workshop.host.id}`,}, workshop.host.name) :
                h('span#workshop-host-name', workshop.host.name),
              h('a#workshop-host-address.small', {href: workshop.host.mapUrl, target: '_blank',},
                workshop.host.address),
            ]),
          ]),
          h('#workshop-leader', [
            `Led by`, nbsp, h('a', {href: `/u/${workshop.owner}`,}, workshop.ownerName),
          ]),
          h('#workshop-description', [convertHtmlToReact(workshop.description),]),
        ]),
      ]),
    ])
  },
}
