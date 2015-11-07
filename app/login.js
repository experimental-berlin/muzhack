'use strict'
let h = require('react-hyperscript')
let component = require('omniscient')
let immutable = require('immutable')
let logger = require('js-logger').get('login')

let {nbsp,} = require('./specialChars')
let FocusingInput = require('./focusingInput')

require('./login.styl')

let SignInForm = component('SignInForm', () => {
  return h('form#signin-form.pure-form.pure-form-stacked', {action: 'action',}, [
    h('fieldset', [
      h('legend', 'Account Info'),
      FocusingInput({
        id: 'signin-email',
        classes: ['account-email',],
        placeholder: 'email or username',
        name: 'email',
        required: true,
      }),
      h('input.account-password', {
        type: 'password',
        placeholder: 'password',
        name: 'password',
        required: true,
      }),
    ]),
    h('.button-group', [
      h('input#login-button.pure-button.pure-button-primary', {
        type: 'submit',
        value: 'Sign in',
      }),
      h('a#forgot-password.small', {href: '/account/forgotpassword',}, 'Forgot password?'),
    ]),
  ])
})

let SignUpForm = component('SignUpForm', () => {
  return h('form#signup-form.pure-form.pure-form-stacked', {
    action: 'action',
  }, [
    h('#userhint', [
      h('span.required-asterisk', `*${nbsp}`),
      'indicates a required field',
    ]),
    h('fieldset', [
      h('legend', 'Account Info'),
      h('.required', [
        FocusingInput({
          id: 'signup-username',
          classes: ['account-username',],
          placeholder: 'email or username',
          name: 'email',
          required: true,
        }),
      ]),
      h('.required', [
        h('input.account-password', {
          type: 'password',
          'placeholder': 'password',
          required: true,
        }),
      ]),
      h('.required', [
        h('input.account-password-confirm', {
          type: 'password',
          placeholder: 'confirm password',
          required: true,
        }),
      ]),
      h('.required', [
        h('input#signup-email.account-email', {
          autofocus: true,
          type: 'email',
          placeholder: 'email',
          required: true,
        }),
      ]),
      h('.required', [
        h('input#signup-name.account-name', {
          autofocus: true,
          type: 'text',
          placeholder: 'name',
          required: true,
        }),
      ]),
      h('input#signup-website.account-website', {
        autofocus: true,
        type: 'url',
        placeholder: 'website',
      }),
    ]),
    h('.button-group', [
      h('input#signup-button.pure-button.pure-button-primary', {
        type: 'submit',
        value: 'Sign up',
      }),
    ]),
  ])
})

module.exports.render = (cursor) => {
  logger.debug(`Login rendering`)
  let showSignIn = cursor.cursor('login').get('activeTab') === 'signIn'
  let signInClass = showSignIn ? '.active' : ''
  let signUpClass = !showSignIn ? '.active' : ''

  return h('.pure-g', [
    h('.pure-u-1-5'),
    h('.pure-u-3-5', [
      h('.login-pad', [
        h('.login-header', [
          h('.login-prompt', `Welcome to MuzHack`),
          h('.tabs', [
            h(`#login-signin-tab.tab${signInClass}`, {
              onClick: () => {
                if (cursor.cursor('login').get('activeTab') !== 'signIn') {
                  logger.debug(`Switching to sign in tab`)
                  cursor.cursor('login').set('activeTab', 'signIn')
                }
              },
            }, 'Sign In'),
            h(`#login-signup-tab.tab${signUpClass}`,{
              onClick: () => {
                if (cursor.cursor('login').get('activeTab') !== 'signUp') {
                  logger.debug(`Switching to sign up tab`)
                  cursor.cursor('login').set('activeTab', 'signUp')
                }
              },
            }, 'Sign Up'),
          ]),
        ]),
        showSignIn ? SignInForm() : SignUpForm(),
      ]),
    ]),
    h('.pure-u-1-5'),
  ])
}

module.exports.createState = () => {
  return immutable.fromJS({
    activeTab: 'signIn',
  })
}
