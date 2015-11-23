'use strict'
let h = require('react-hyperscript')
let logger = require('js-logger-aknudsen').get('forgotPassword')

let FocusingInput = require('./focusingInput')
let router = require('../router')
let ajax = require('../client/ajax')

if (__IS_BROWSER__) {
  require('./login.styl')
}

module.exports = {
  redirectIfLoggedIn: true,
  render: (cursor) => {
    logger.debug(`Rendering`)
    let forgotPasswordCursor = cursor.cursor('forgotPassword')
    let showRedirect = forgotPasswordCursor.get('showRedirect')
    let seconds = forgotPasswordCursor.get('remainingSeconds')
    let remainingSecondsString = `${seconds} second${seconds !== 1 ? 's' : ''}`
    let content = !showRedirect ?
      h('.login-pad', [
        h('.login-header', [
          h('.login-prompt', `Find your MuzHack Account`),
        ]),
        h('form#forgotpassword-form.pure-form.pure-form-stacked', {action: 'action',}, [
          h('fieldset', [
            h('legend', 'Account Info'),
            FocusingInput({
              id: 'account-email',
              type: 'email',
              placeholder: 'email',
              classes: ['account-email',],
              required: true,
              onChange: (event) => {
                logger.debug('Setting emailOrUsername')
                cursor.cursor('forgotPassword').set('emailOrUsername', event.target.value)
              },
            }),
          ]),
          h('.button-group', [
            h('input#submit-button.pure-button.pure-button-primary', {
              type: 'submit',
              onClick: (event) => {
                event.preventDefault()
                logger.debug('Submitting forgot password dialog')
                ajax.postJson('resetPassword', {
                  username: cursor.cursor('forgotPassword').get('emailOrUsername'),
                }).then(() => {
                  let redirectTo = '/'
                  logger.info(`Request to reset password successfully sent`)
                }, () => {
                  logger.warn(`Resetting password failed`)
                })
              }, value: 'Search',
            }),
            h('button#cancel-button.pure-button', {
              onClick: (event) => {
                event.preventDefault()
                logger.debug('Canceling forgot password dialog')
                router.goTo('/login')
              },
            }, 'Cancel'),
          ]),
        ]),
      ]) : h('#password-reset-page', [
        h('p', `You should've been sent an email to reset your password.
  You're being redirected to the login page in ${remainingSecondsString}...`),
      ])

    return h('.pure-g', [
      h('.pure-u-1-5'),
      h('.pure-u-3-5', [content,]),
    ])
  },
}
