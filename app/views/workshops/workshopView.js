'use strict'
let component = require('omniscient')
let R = require('ramda')
let S = require('underscore.string.fp')
let h = require('react-hyperscript')
let immutable = require('immutable')
let logger = require('js-logger-aknudsen').get('workshopView')
let moment = require('moment')

let ajax = require('../../ajax')
let {nbsp,} = require('../../specialChars')
let {convertMarkdown,} = require('../../markdown')
let VCard = require('./workshopsVCard')
let {partitionWorkshops,} = require('../workshopsCommon')

if (__IS_BROWSER__) {
  require('./workshopsUserProfile.styl')
}

let About = component('About', (user) => {
  return convertMarkdown(user.about)
})

let Workshops = component('Workshops', (user) => {
  let renderWorkshops = (workshops, type) => {
    return h(`#user-${type}-workshops`, [
      h('h2', `${S.capitalize(type)} Workshops`),
      h(`.table.table-striped`, R.map((workshop) => {
        let rowClasses = [`table-row`,]
        return h(`a.${S.join('.', rowClasses)}`, {
          href: `/u/${workshop.owner}/${workshop.id}`,
        }, [
          h('.table-cell', moment(workshop.startTime).format(`MMM D`)),
          h('.table-cell', workshop.title),
          h('.table-cell', workshop.venue.name),
       ])
     }, R.sortBy(R.prop('startTime'), workshops))),
   ])
  }

  let {username,} = user
  let [upcomingWorkshops, pastWorkshops,] = partitionWorkshops(user)
  return !R.isEmpty(upcomingWorkshops) || !R.isEmpty(pastWorkshops) ? h('div', [
    !R.isEmpty(upcomingWorkshops) ? renderWorkshops(upcomingWorkshops, `upcoming`): null,
   !R.isEmpty(pastWorkshops) ? renderWorkshops(pastWorkshops, `past`) : null,
  ]) : h('em', 'No workshops have been registered for this user.')
})

let isActiveTab = (tabName, cursor) => {
  return cursor.cursor('userProfile').get('activeTab') === tabName
}

class UserTab {
  constructor(title, icon, enabled) {
    enabled = enabled == null ? true : enabled
    this.title = title
    this.icon = icon
    this.enabled = enabled
    this.name = title.toLowerCase()
    this.url = `#${title.toLowerCase()}`
  }

  getClasses(activeTab) {
    let classes
    if (this.name === activeTab) {
      logger.debug(`${this.name} is active tab`)
      classes = ['active',]
    } else {
      classes = []
    }
    return S.join(' ', R.concat(classes, !this.enabled ? ['disabled',] : []))
  }
}

module.exports = {
  createState: () => {
    return immutable.fromJS({
      activeTab: 'projects',
    })
  },
  loadData: (cursor, params) => {
    return ajax.getJson(`/api/users/${params.user}`)
      .then((user) => {
        logger.debug(`Loading user JSON succeeded:`, user)
        return {
          userProfile: {
            user: user,
            activeTab: 'projects',
          },
        }
      }, (error) => {
        logger.warn(`Loading user JSON failed:`, error)
        if (typeof error !== 'string') {
          throw error
        } else {
          throw new Error(error)
        }
      })
  },
  render: (cursor) => {
    let profileCursor = cursor.cursor('userProfile')
    let user = profileCursor.get('user').toJS()
    let currentHash = cursor.cursor('router').get('currentHash')
    let soundCloud = user.soundCloud || {}
    let profileTabs = [
      new UserTab('About'),
      new UserTab('Workshops'),
    ]
    let activeTab = R.contains(currentHash, R.map((tab) => {
      return tab.name
    }, profileTabs)) ? currentHash : 'about'

    logger.debug(`Rendering profile of user '${user.username}', active tab '${activeTab}':`, user)
    logger.debug(`State:`, profileCursor.toJS())
    let tabContents
    if (activeTab === 'about') {
      tabContents = About(user)
    } else if (activeTab === 'workshops') {
      tabContents = Workshops(user)
    }

    return h('#user-pad', [
      h('.pure-g', [
        h('.pure-u-1.pure-u-md-6-24', [
          VCard({cursor, user,}),
        ]),
        h('.pure-u-1.pure-u-md-18-24', [
          h('ul.tabs', {role: 'tablist',}, R.map((profileTab) => {
            return h(`li.${S.join('.', profileTab.getClasses(activeTab))}`, [
              profileTab.enabled ? h('a', {
                role: 'tab',
                href: profileTab.url,
              }, [
                profileTab.icon != null ? h(`span.icon-${profileTab.icon}`, nbsp) : null,
                h('span', profileTab.title),
              ]) : h('div', [
                profileTab.icon != null ? h(`span.icon-${profileTab.icon}`, nbsp) : null,
                h('span', profileTab.title),
              ]),
            ])
          }, profileTabs)),
          h('#tab-contents', [tabContents,]),
        ]),
      ]),
    ])
  },
}
