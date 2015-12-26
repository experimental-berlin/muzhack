'use strict'
let component = require('omniscient')
let h = require('react-hyperscript')
let logger = require('js-logger-aknudsen').get('userProfile/projectPlans')
let R = require('ramda')
let immutable = require('immutable')

let userManagement = require('../../userManagement')
let TransparentButton = require('../../transparentButton')
let ajax = require('../../ajax')
let {nbsp,} = require('../../specialChars')
let notification = require('../notification')
let FocusingInput = require('../focusingInput')
let Modal = require('../modal')

let trello
if (__IS_BROWSER__) {
  trello = require('../../lib/trello')
}

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

let RemovePlanModal = component('RemovePlanModal', ({username, cursor,}) => {
  let projectPlan = cursor.cursor('userProfile').get('askRemovePlan')
  return notification.question(`Remove Project Plan?`,
    `Are you sure you wish to remove the project plan ${projectPlan.name}?`, () => {
      logger.debug(`User confirmed removing project plan '${projectPlan.id}'`)
      return ajax.delete(`/api/users/${username}/projectPlans/${projectPlan.id}`)
        .then((user) => {
          logger.debug(`Successfully removed project plan '${projectPlan.id}':`, user)
          cursor.cursor('userProfile').update((current) => {
            return current.merge({
              askRemovePlan: null,
              user: current.get('user').merge({
                projectPlans: immutable.fromJS(user.projectPlans),
              }),
            })
          })
          logger.debug(`After removal:`, cursor.toJS())
        })
    }, () => {
      cursor.cursor('userProfile').set('askRemovePlan', null)
    })
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

let ProjectPlans = component('ProjectPlans', ({user, cursor,}) => {
  let loggedInUser = userManagement.getLoggedInUser(cursor)
  let username = user.username
  let isLoggedInUser = loggedInUser != null && loggedInUser.username === username
  let profileCursor = cursor.cursor('userProfile')
  return h('div', [
    profileCursor.get('showAddNewPlan') ? AddNewPlanModal({username, cursor,}) : null,
    profileCursor.get('askRemovePlan') ? RemovePlanModal({username, cursor,}) : null,
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
              profileCursor.set('showEditPlan', true)
            },
          }, [
            h('span.icon-pencil3'),
          ]),
          TransparentButton({
            classes: ['remove-project-plan',],
            'data-tooltip': 'Remove project plan',
            onClick: () => {
              logger.debug(`Removing project plan`)
              profileCursor.set('askRemovePlan', projectPlan)
            },
          }, [
            h('span.icon-cross'),
          ]),
          TransparentButton({
            classes: ['close-project-plan',],
            'data-tooltip': 'Remove project plan and close Trello board',
            onClick: () => {
              logger.debug(`Removing project plan and closing Trello board`)
              profileCursor.set('askClosePlan', true)
            },
          }, [
            h('span.icon-bin'),
          ]),
        ]) : null,
      ])
    }, user.projectPlans)) : h('em', 'No project plans.'),
  ])
})

module.exports = {
  ProjectPlans,
}
