'use strict'
let component = require('omniscient')
let R = require('ramda')
let S = require('underscore.string.fp')
let h = require('react-hyperscript')
let immutable = require('immutable')
let logger = require('js-logger-aknudsen').get('userProfile')

let ajax = require('../../ajax')
let {nbsp,} = require('../../specialChars')
let VCard = require('./vcard')
let {convertMarkdown,} = require('../../markdown')
let datetime = require('../../datetime')
let {ProjectPlans,} = require('./projectPlans')

if (__IS_BROWSER__) {
  require('./userProfile.styl')
}

let About = component('About', (user) => {
  return h('div', [
    h('h1', `About ${user.name}`),
    convertMarkdown(user.about),
  ])
})

let Projects = component('Projects', (user) => {
  let {username,} = user
  return !R.isEmpty(user.projects) ? h('table#user-projects', [
    h('thead', [
      h('tr', [
        h('th', 'ID'),
        h('th', 'Name'),
        h('th', 'Created'),
      ]),
    ]),
    h('tbody', R.map((project) => {
      let {projectId, title,} = project
      let createdStr = datetime.displayDateTextual(project.created)
      return h('tr', [
        h('td', [
          h('a.user-project', {href: `/u/${username}/${projectId}`,}, projectId),
        ]),
        h('td', [
          h('a.user-project', {href: `/u/${username}/${projectId}`,}, title),
        ]),
        h('td', [
          h('a.user-project', {href: `/u/${username}/${projectId}`,}, createdStr),
        ]),
      ])
    }, user.projects)),
  ]) : h('em', 'No projects.')
})

let SoundCloudUpload = component('SoundCloudUpload', {
  componentDidMount: function () {
    let upload = this.props.upload
    logger.debug(`SoundCloud upload did mount`, upload)
    let uploadElem = this.refs.soundCloudUpload
    logger.debug('Got SoundCloud upload element:', uploadElem)
    uploadElem.innerHTML = upload.html
  },
}, () => {
   return h('.soundcloud-upload', {ref: `soundCloudUpload`,})
})

let Media = component('Media', (user) => {
  let soundCloud = user.soundCloud || {}
  return h('div', !R.isEmpty(user.soundCloudUploads) ? [
    h('h1#soundcloud-header', [
      h('span.icon-soundcloud', 'SoundCloud'),
    ]),
    h('p', `${S.words(user.name)[0]}'s sounds on SoundCloud`),
    h('ul#soundcloud-uploads', R.map((upload) => {
      return h('li', [SoundCloudUpload({upload,}),])
    }, soundCloud.uploads)),
  ] : null)
})

let Workshops = component('Workshops', (user) => {
  return convertMarkdown(user.workshopsInfo)
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
        throw error
      })
  },
  render: (cursor) => {
    let profileCursor = cursor.cursor('userProfile')
    let user = profileCursor.get('user').toJS()
    let currentHash = cursor.cursor('router').get('currentHash')
    let soundCloud = user.soundCloud || {}
    let profileTabs = [
      new UserTab('Projects'),
      new UserTab('Plans'),
      new UserTab('About'),
      new UserTab('Media', null, !R.isEmpty(soundCloud.uploads || [])),
      new UserTab('Workshops', null, !S.isBlank(user.workshopsInfo)),
    ]
    let activeTab = R.contains(currentHash, R.map((tab) => {
      return tab.name
    }, profileTabs)) ? currentHash : 'projects'

    logger.debug(`Rendering profile of user '${user.username}', active tab '${activeTab}':`, user)
    logger.debug(`State:`, profileCursor.toJS())
    let tabContents
    if (activeTab === 'about') {
      tabContents = About(user)
    } else if (activeTab === 'projects') {
      tabContents = Projects(user)
    } else if (activeTab === 'plans') {
      tabContents = ProjectPlans({user, cursor,})
    } else if (activeTab === 'media') {
      tabContents = Media(user)
    } else if (activeTab === 'workshops') {
      tabContents = Workshops(user)
    }

    return h('#user-pad', [
      h('.pure-g', [
        h('.pure-u-1-4', [
          VCard({cursor, user,}),
        ]),
        h('.pure-u-3-4', [
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
