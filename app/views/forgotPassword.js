'use strict'
let h = require('react-hyperscript')
let logger = require('js-logger-aknudsen').get('forgotPassword')

let FocusingInput = require('./focusingInput')
let router = require('../router')
let ajax = require('../ajax')

if (__IS_BROWSER__) {
  require('./login.styl')
}

module.exports = {
  shouldRenderServerSide: false,
  redirectIfLoggedIn: true,
  render: (cursor) => {
    logger.debug(`Rendering`)
    let forgotPasswordCursor = cursor.cursor('forgotPassword')
    let seconds = forgotPasswordCursor.get('remainingSeconds')
    let showRedirect = seconds != null
    let remainingSecondsString = `${seconds} second${seconds !== 1 ? 's' : ''}`
    if (showRedirect) {
      logger.debug(`Showing redirect timeout - remaining seconds: ${remainingSecondsString}`)
    } else {
      logger.debug(`Not showing redirect timeout`)
    }
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
              placeholder: 'email or username',
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
                let usernameOrEmail = cursor.cursor('forgotPassword').get('emailOrUsername')
                logger.debug(`Submitting forgot password dialog: '${usernameOrEmail}'`)
                ajax.postJson('/api/forgotPassword', {
                  username: usernameOrEmail,
                }).then(() => {
                  let countDown = () => {
                    let remainingSeconds = forgotPasswordCursor.get('remainingSeconds')
                    if (remainingSeconds > 1) {
                      logger.debug(`Counting down until redirect...`)
                      forgotPasswordCursor = forgotPasswordCursor.set('remainingSeconds',
                        remainingSeconds-1)
                      setTimeout(countDown, 1000)
                    } else {
                      let redirectTo = '/login'
                      logger.debug(`Redirect timeout reached, redirecting to ${redirectTo}`)
                      forgotPasswordCursor = forgotPasswordCursor.set('remainingSeconds', null)
                      router.goTo(redirectTo)
                    }
                  }

                  logger.info(`Forgot password request successfully sent`)
                  logger.debug(`Setting remainingSeconds to 5`)
                  forgotPasswordCursor = forgotPasswordCursor.set(`remainingSeconds`, 5)
                  setTimeout(countDown, 1000)
                }, () => {
                  logger.warn(`Submitting forgot password request failed`)
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
      ]) : h('#forgot-password-page', [
        h('p', `You should've been sent an email to reset your password.
  You're being redirected to the login page in ${remainingSecondsString}...`),
      ])

    return h('.pure-g', [
      h('.pure-u-1-5'),
      h('.pure-u-3-5', [content,]),
    ])
  },
}
