'use strict'
let h = require('react-hyperscript')
let logger = require('js-logger-aknudsen').get('resetPassword')

let FocusingInput = require('./focusingInput')
let router = require('../router')
let ajax = require('../ajax')

if (__IS_BROWSER__) {
  require('./login.styl')
}

module.exports = {
  shouldRenderServerSide: false,
  redirectIfLoggedIn: true,
  loadData: (cursor, params) => {
    let token = params.token
    if (token == null) {
      throw new Error(`Token parameter is not provided`)
    }
    return {
      resetPassword: {
        token,
      },
    }
  },
  render: (cursor) => {
    logger.debug(`Rendering`)
    let resetPasswordCursor = cursor.cursor('resetPassword')
    logger.debug(`State:`, resetPasswordCursor.toJS())
    let token = resetPasswordCursor.get('token')
    let seconds = resetPasswordCursor.get('remainingSeconds')
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
          h('.login-prompt', `Reset Password`),
        ]),
        h('form#resetpassword-form.pure-form.pure-form-stacked', {action: 'action',}, [
          h('fieldset', [
            h('legend', 'Password'),
            FocusingInput({
              id: 'account-password',
              placeholder: 'password',
              name: 'password',
              classes: ['account-password',],
              required: true,
              type: 'password',
              onChange: (event) => {
                logger.debug('Setting password')
                resetPasswordCursor = resetPasswordCursor.set('password', event.target.value)
              },
            }),
            FocusingInput({
              id: 'account-password-confirm',
              placeholder: 'confirm password',
              name: 'confirmPassword',
              classes: ['account-password-confirm',],
              required: true,
              type: 'password',
              onChange: (event) => {
                logger.debug('Setting confirmPassword')
                resetPasswordCursor = resetPasswordCursor.set('confirmPassword', event.target.value)
              },
            }),
          ]),
          h('.button-group', [
            h('input#submit-button.pure-button.pure-button-primary', {
              type: 'submit',
              onClick: (event) => {
                event.preventDefault()
                let resetPasswordCursor = cursor.cursor('resetPassword')
                let password = resetPasswordCursor.get('password')
                let confirmPassword = resetPasswordCursor.get('confirmPassword')
                if (password !== confirmPassword) {
                  throw new Error(`Passwords don't match`)
                }

                logger.debug(`Submitting reset password dialog for token '${token}'`)
                ajax.postJson(`resetPassword/${token}`, {
                  password,
                }).then(() => {
                  let countDown = () => {
                    let remainingSeconds = resetPasswordCursor.get('remainingSeconds')
                    if (remainingSeconds > 1) {
                      logger.debug(`Counting down until redirect...`)
                      resetPasswordCursor = resetPasswordCursor.set('remainingSeconds',
                        remainingSeconds-1)
                      setTimeout(countDown, 1000)
                    } else {
                      let redirectTo = '/'
                      logger.debug(`Redirect timeout reached, redirecting to ${redirectTo}`)
                      resetPasswordCursor = resetPasswordCursor.set('remainingSeconds', null)
                      router.goTo(redirectTo)
                    }
                  }

                  logger.info(`Request to reset password successfully sent`)
                  logger.debug(`Setting remainingSeconds to 5`)
                  resetPasswordCursor = resetPasswordCursor.set(`remainingSeconds`, 5)
                  setTimeout(countDown, 1000)
                }, () => {
                  logger.warn(`Resetting password failed`)
                })
              }, value: 'Reset Password',
            }),
          ]),
        ]),
      ]) : h('#password-reset-page', [
        h('p', `Thank you. Your password has been successfully reset.
 You're being redirected to the home page in ${remainingSecondsString}...`),
      ])

    return h('.pure-g', [
      h('.pure-u-1-5'),
      h('.pure-u-3-5', [content,]),
    ])
  },
}
