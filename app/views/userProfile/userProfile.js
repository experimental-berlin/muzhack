'use strict'
let component = require('omniscient')
let R = require('ramda')
let S = require('underscore.string.fp')
let h = require('react-hyperscript')
let immutable = require('immutable')
let logger = require('js-logger-aknudsen').get('userProfile')
let React = require('react')

let ajax = require('../../ajax')
let {nbsp,} = require('../../specialChars')
let VCard = require('./vcard')
let {convertMarkdown,} = require('../../markdown')
let userManagement = require('../../userManagement')
let datetime = require('../../datetime')
let notification = require('../notification')
let FocusingInput = require('../focusingInput')
let Modal = require('../modal')
let TransparentButton = require('../../transparentButton')

let trello
if (__IS_BROWSER__) {
  trello = require('../../lib/trello')
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

let getPlanModal = (cursor, title, fields, submitCallback, closeCallback) => {
  let content = h('div', [
    h('.modal-body-content', [
      h('form.pure-form.pure-form-stacked', [
        h('fieldset', fields),
      ]),
    ]),
    h('.button-group', [
      h('button.pure-button.pure-button-primary', {
        onClick: () => {
          logger.debug(`OK button clicked`)
          submitCallback()
        },
      }, 'OK'),
      h('button.pure-button', {
        onClick: () => {
          logger.debug(`Cancel button clicked`)
          closeCallback()
        },
      }, 'Cancel'),
    ]),
  ])

  return Modal({closeCallback, title, content,})
}

let AddNewPlanModal = component('AddNewPlanModal', ({username, cursor,}) => {
  let profileCursor = cursor.cursor('userProfile')

  let closeCallback = () => {
    profileCursor.set('showAddNewPlan', false)
  }

  let submit = () => {
    let newPlan = profileCursor.cursor('newPlan').toJS()
    logger.debug(`Submitting new project plan...:`, newPlan)
    invokeTrelloApi(cursor, (token) => {
      return ajax.postJson(`/api/users/${username}/projectPlans`, R.merge({token,}, newPlan))
        .then((updatedUser) => {
          logger.info(`Successfully posted new project plan to server, updated user:`, updatedUser)
          profileCursor = profileCursor.merge({
            user: updatedUser,
          })
          closeCallback()
        }, (err) => {
          let {statusCode, error,} = err
          logger.info(`Failed to post new project plan to server: ${error}`)
          notification.warn(`Error`, `Failed to create new project plan: '${error}'`, cursor)
        })
    })
  }

  let onChange = (parameter, event) => {
    logger.debug(`Input detected for parameter '${parameter}'`)
    profileCursor.cursor('newPlan').set(parameter, event.currentTarget.value)
  }

  logger.debug(`Rendering AddNewPlanModal`)
  let fields = [
    FocusingInput({
      id: 'create-board-name',
      classes: ['modal-input',],
      placeholder: 'Name',
      onChange: R.partial(onChange, ['name',]),
      onEnter: submit,
    }),
    h('input#create-board-description.modal-input', {
      placeholder: 'Description',
      onChange: R.partial(onChange, ['description',]),
      onEnter: submit,
    }),
    h('input#create-board-organization.modal-input', {
      placeholder: 'Organization',
      onChange: R.partial(onChange, ['organization',]),
      onEnter: submit,
    }),
  ]
  return getPlanModal(cursor, 'Create Trello Board', fields, submit, closeCallback)
})

let AddExistingPlanModal = component('AddExistingPlanModal', ({username, cursor,}) => {
  let profileCursor = cursor.cursor('userProfile')

  let closeCallback = () => {
    profileCursor.set('showAddExistingPlan', false)
  }

  let submit = () => {
    logger.debug(`Submitting new project plan...`)
    closeCallback()
  }

  logger.debug(`Rendering AddExistingPlanModal`)
  let fields = [
    h('select#add-existing-board-select.modal-select', {
      name: 'boardId',
      defaultValue: null,
    }, [
      h('option', {
        disabled: true,
      }, 'Choose a Trello board'),
    ]),
  ]
  return getPlanModal(cursor, 'Add Existing Trello Board', fields, submit, closeCallback)
})

let invokeTrelloApi = (cursor, callback) => {
  cursor.cursor('router').set('isLoading', 'Calling Trello')
  logger.debug(`Asking Trello for authorization...`)
  return trello.authorize(cursor.get('trelloKey'), {
      type: 'popup',
      name: 'MuzHack',
      scope: { read: true, 'write': true, },
  })
    .then((token) => {
      cursor.cursor('router').set('isLoading', false)
      logger.info(`Trello authorization succeeded`)
      return callback(token)
    }, (error) => {
      cursor.cursor('router').set('isLoading', false)
      logger.warn(`Trello authorization failed`)
      notification.warn(`Error`, `Trello authorization failed`)
    })
}

let Plans = component('Plans', ({user, cursor,}) => {
  let loggedInUser = userManagement.getLoggedInUser(cursor)
  let username = user.username
  let isLoggedInUser = loggedInUser != null && loggedInUser.username === username
  let profileCursor = cursor.cursor('userProfile')
  return h('div', [
    profileCursor.get('askRemovePlan') ? notification.question('Remove/Close Project Plan?',
      'Are you sure you wish to remove the project plan #{@name} and close the Trello board?',
      removeProjectPlan, () => {
        cursor.set('askRemovePlan', false)
      }) : null,
    profileCursor.get('showAddNewPlan') ? AddNewPlanModal({username, cursor,}) : null,
    profileCursor.get('showAddExistingPlan') ? AddExistingPlanModal({username, cursor,}) : null,
    isLoggedInUser ? h('#plan-buttons.button-group', [
      h('button#create-plan.pure-button', {
        'data-tooltip': 'Create project plan',
        onClick: () => {
          logger.debug(`Showing dialog to add new project plan...`)
          cursor.cursor('userProfile').merge({
            showAddNewPlan: true,
            newPlan: {},
          })
        },
      }, 'New'),
      h('button#add-existing-plan.pure-button', {
        'data-tooltip': 'Add existing project plan',
        onClick: () => {
          logger.debug(`Showing dialog to add existing project plan...`)
          cursor.cursor('userProfile').set('showAddExistingPlan', true)
        },
      }, 'Add Existing'),
      h('hr'),
    ]) : null,
    !R.isEmpty(user.projectPlans) ? h('ul#planned-projects', R.map((projectPlan) => {
      return h('li', [
        h('a.planned-project', {href: projectPlan.url, target: '_blank',}, [
          h('span.icon-trello'),
          `${nbsp}${projectPlan.name}`,
        ]),
        isLoggedInUser ? h('.planned-project-controls', [
          TransparentButton({
            classes: ['edit-project-plan',],
            onClick: () => {
              logger.debug(`Editing project plan`)
            },
          }, [
            h('span.icon-pencil3'),
          ]),
          TransparentButton({
            classes: ['remove-project-plan',],
            'data-tooltip': 'Remove project plan',
            onClick: () => {
              logger.debug(`Removing project plan`)
              cursor.set('askRemovePlan', true)
            },
          }, [
            h('span.icon-cross'),
          ]),
          TransparentButton({
            classes: ['close-project-plan',],
            'data-tooltip': 'Remove project plan and close Trello board',
            onClick: () => {
              logger.debug(`Removing project plan and closing Trello board`)
            },
          }, [
            h('span.icon-bin'),
          ]),
        ]) : null,
      ])
    }, user.projectPlans)) : h('em', 'No project plans.'),
  ])
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
        logger.warn(`Loading user JSON failed: '${error}'`)
        throw new Error(error)
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
      tabContents = Plans({user, cursor,})
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
