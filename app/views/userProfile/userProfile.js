'use strict'
let component = require('omniscient')
let R = require('ramda')
let S = require('underscore.string.fp')
let h = require('react-hyperscript')
let immutable = require('immutable')
let logger = require('js-logger').get('userProfile')

let datetime = require('../../datetime')
let ajax = require('../../ajax')
let {nbsp,} = require('../../specialChars')
let account = require('../../account')

require('./userProfile.styl')

let VCard = component('VCard', (user) => {
  let userProfileUrl = account.getUserProfileUrl(user.username)
  let userJoined = datetime.displayDateTextual(user.createdAt)
  return h('#vcard', [
    h('#user-avatar', [
      h('a', {href: userProfileUrl,}, [
        h('img', {src: user.avatar, width: 230, height: 230,}),
      ]),
    ]),
    h('#user-name', user.name),
    h('#user-username.muted', user.username),
    h('hr'),
    h('#user-email.vcard-detail', [
      h('span.icon-envelop3', nbsp),
      h('span', user.email),
      !S.isBlank(user.website) ? h('#user-website.vcard-detail', [
        h('span.icon-link'),
        h('a', {href: user.website, target: '_blank',}, user.website),
      ]) : null,
      user.soundCloud != null ? h('#user-soundcloud.vcard-detail', [
        h('span.icon-soundcloud'),
        h('a', {
          href: `https://soundcloud.com/${user.soundCloud.username}`, target: '_blank',
        }, user.soundCloud.name),
      ]) : null,
      h('#user-joined.vcard-detail', [
        h('span.icon-calendar', nbsp),
        h('span', `Joined ${userJoined}`),
      ]),
      !S.isBlank(user.about) ? h('div', [
        h('hr'),
        h('#user-about-short.vcard-detail', [
          h('a', {href: '#about',}, `About ${userFirstName}`),
        ]),
      ]) : null,
    ]),
  ])
})

let About = component('About', (user) => {
  return h('div', [
    h('h1', `About ${userFullName}`),
    convertMarkdown(aboutUser),
  ])
})

let Projects = component('Projects', (user) => {
  return !R.isEmpty(user.projects) ? h('table#user-projects', [
    h('thead', [
      h('tr', [
        h('th', 'ID'),
        h('th', 'Name'),
        h('th', 'Created'),
      ]),
    ]),
    h('tbody', R.map((project) => {
      h('tr', [
        h('td', [
          h('a.user-project', {href: `/u/${owner}/${projectId}`,}, projectId),
        ]),
        h('td', [
          h('a.user-project', {href: `/u/${owner}/${projectId}`,}, title),
        ]),
        h('td', [
          h('a.user-project', {href: `/u/${owner}/${projectId}`,}, createdStr),
        ]),
      ])
    }, user.projects)),
  ]) : h('em', 'No projects.')
})

let Plans = component('Plans', (user) => {
  return h('div', [
    isLoggedInUser ? h('#plan-buttons.button-group', [
      h('button#create-plan.pure-button', {'data-tooltip': 'Create project plan',}, 'New'),
      h('button#add-existing-plan.pure-button', {
        'data-tooltip': 'Add existing project plan',
      }, 'Add Existing'),
      h('hr'),
    ]) : null,
    hasProjectPlans ? h('ul#planned-projects', R.map((projectPlan) => {
      return h('li', [
        h('a.planned-project', {href: url, target: '_blank',}, [
          h('span.icon-trello', name),
          isLoggedInUser ? h('div', [
            h('a.edit-project-plan', {href: '#', 'data-tooltip': 'Edit project plan',}, [
              h('span.icon-pencil3'),
            ]),
            h('a.remove-project-plan', {href: '#', 'data-tooltip': 'Remove project plan',}, [
              'span.icon-cross',
            ]),
            h('a.close-project-plan', {
              href: '#', 'data-tooltip': 'Remove project plan and close Trello board',
            }, [
              h('span.icon-bin'),
            ]),
          ]) : null,
        ]),
      ])
    }, user.projectPlans)) : h('em', 'No project plans.'),
  ])
})

let Media = component('Media', (user) => {
  return h('div') //   +soundCloud
})

let Workshops = component('Workshops', (user) => {
  return convertMarkdown(user.workshopsInfo)
})

let isActiveTab = (tabName, cursor) => {
  return cursor.cursor('userProfile').get('activeTab') === tabName
}

class UserTab {
  constructor(title, icon, enabled=true) {
    this.title = title
    this.icon = icon
    this.enabled = enabled
    this.name = title.toLowerCase()
    this.url = `#${title.toLowerCase()}`
  }

  getClasses(cursor) {
    let classes
    if (isActiveTab(this.name, cursor)) {
      logger.debug(`${this.name} is active tab`)
      classes = ['active',]
    } else {
      classes = []
    }
    return S.join(' ', R.concat(classes, !this.enabled ? ['disabled',] : []))
  }
}

module.exports.createState = () => {
  return immutable.fromJS({
    activeTab: 'projects',
  })
}

module.exports.routeOptions = {
  loadData: (cursor, params) => {
    return ajax.getJson(`users/${params.user}`)
      .then((user) => {
        logger.debug(`Loading user JSON succeeded:`, user)
        return {
          userProfile: {
            user: user,
            activeTab: 'projects',
          },
        }
      }, (reason) => {
        logger.warn(`Loading user JSON failed: '${reason}'`)
      })
  },
  render: (cursor) => {
    let profileCursor = cursor.cursor('userProfile')
    let activeTab = profileCursor.get('activeTab')

    let profileTabs = [
      new UserTab('Projects'),
      new UserTab('Plans'),
      new UserTab('About', null),
      new UserTab('Media', null),
      new UserTab('Workshops', null),
    ]

    let user = profileCursor.get('user').toJS()
    logger.debug(`Rendering profile of user '${user.username}'`, user)
    let tabContents
    if (activeTab === 'about') {
      tabContents = About(user)
    } else if (activeTab === 'projects') {
      tabContents = Projects(user)
    } else if (activeTab === 'plans') {
      tabContents = Plans(user)
    } else if (activeTab === 'media') {
      tabContents = Media(user)
    } else if (activeTab === 'workshops') {
      tabContents = Workshops(user)
    }

    return h('#user-pad', [
      h('.pure-g', [
        h('.pure-u-1-4', [
          VCard(user),
        ]),
        h('.pure-u-3-4', [
          h('ul.tabs', {role: 'tablist',}, R.map((profileTab) => {
            return h(`li.${S.join('.', profileTab.getClasses(cursor))}`, [
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
