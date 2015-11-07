'use strict'
let h = require('react-hyperscript')
let component = require('omniscient')
let immutable = require('immutable')
let logger = require('js-logger').get('login')
let R = require('ramda')

let {nbsp,} = require('./specialChars')
let ajax = require('./ajax')
let FocusingInput = require('./focusingInput')
let router = require('./router')

require('./login.styl')

let SignInForm = component('SignInForm', (cursor) => {
  return h('form#signin-form.pure-form.pure-form-stacked', {action: 'action',}, [
    h('fieldset', [
      h('legend', 'Account Info'),
      FocusingInput({
        id: 'signin-email',
        classes: ['account-email',],
        placeholder: 'email or username',
        name: 'email',
        required: true,
        onChange: (event) => {
          logger.debug('Setting emailOrUsername')
          cursor.cursor('login').set('emailOrUsername', event.target.value)
        },
      }),
      h('input.account-password', {
        type: 'password',
        placeholder: 'password',
        name: 'password',
        required: true,
        onChange: (event) => {
          cursor.cursor('login').set('password', event.target.value)
        },
      }),
    ]),
    h('.button-group', [
      h('input#login-button.pure-button.pure-button-primary', {
        type: 'submit',
        value: 'Sign in',
        onClick: (event) => {
          logger.debug(`Signing user in`)
          event.preventDefault()
          let loginCursor = cursor.cursor('login')
          ajax.postJson('login', {
            username: loginCursor.get('emailOrUsername'),
            password: loginCursor.get('password'),
          }).then((user) => {
            let redirectTo = '/'
            logger.info(`User successfully logged in - redirecting to '${redirectTo}'`)
            cursor.set('loggedInUser', user)
            router.goTo(redirectTo)
          }, () => {
            logger.warn(`Logging user in failed`)
          })
        },
      }),
      h('a#forgot-password.small', {href: '/account/forgotpassword',}, 'Forgot password?'),
    ]),
  ])
})

let SignUpForm = component('SignUpForm', (cursor) => {
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
          placeholder: 'username',
          name: 'username',
          required: true,
          onChange: (event) => {
            cursor.cursor('signup').set('username', event.target.value)
          },
        }),
      ]),
      h('.required', [
        h('input.account-password', {
          type: 'password',
          'placeholder': 'password',
          required: true,
          onChange: (event) => {
            cursor.cursor('signup').set('password', event.target.value)
          },
        }),
      ]),
      h('.required', [
        h('input.account-password-confirm', {
          type: 'password',
          placeholder: 'confirm password',
          required: true,
          onChange: (event) => {
            cursor.cursor('signup').set('confirmPassword', event.target.value)
          },
        }),
      ]),
      h('.required', [
        h('input#signup-email.account-email', {
          autofocus: true,
          type: 'email',
          placeholder: 'email',
          required: true,
          onChange: (event) => {
            cursor.cursor('signup').set('email', event.target.value)
          },
        }),
      ]),
      h('.required', [
        h('input#signup-name.account-name', {
          autofocus: true,
          type: 'text',
          placeholder: 'name',
          required: true,
          onChange: (event) => {
            cursor.cursor('signup').set('name', event.target.value)
          },
        }),
      ]),
      h('input#signup-website.account-website', {
        autofocus: true,
        type: 'url',
        placeholder: 'website',
        onChange: (event) => {
          cursor.cursor('signup').set('website', event.target.value)
        },
      }),
    ]),
    h('.button-group', [
      h('input#signup-button.pure-button.pure-button-primary', {
        type: 'submit',
        value: 'Sign up',
        onClick: (event) => {
          logger.debug(`Signing user up`)
          event.preventDefault()
          let data = R.pick([
            'username', 'password', 'email', 'name', 'website',
          ], cursor.get('signup').toJS())
          if (cursor.cursor('signup').get('confirmPassword') !== data.password) {
            throw new Error(`Passwords don't match`)
          }

          logger.debug(`Signing up new user:`, data)
          cursor.cursor('router').set('isLoading', true)
          ajax.postJson('signup', data)
            .then(() => {
              logger.debug(`User signup succeeded`)
              cursor.mergeDeep({
                loggedInUser: {
                  username: data.username,
                },
                router: {
                  isLoading: false,
                },
              })
              router.goTo('/')
            }, (err) => {
              logger.warn(`User signup failed: '${err}'`)
              cursor.cursor('router').set('isLoading', false)
            })
        },
      }),
    ]),
  ])
})

module.exports.routeOptions = {
  redirectIfLoggedIn: true,
  render: (cursor) => {
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
          showSignIn ? SignInForm(cursor) : SignUpForm(cursor),
        ]),
      ]),
      h('.pure-u-1-5'),
    ])
  },
}

module.exports.createState = () => {
  return immutable.fromJS({
    activeTab: 'signIn',
  })
}
