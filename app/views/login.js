'use strict'
let h = require('react-hyperscript')
let component = require('omniscient')
let immutable = require('immutable')
let logger = require('@arve.knudsen/js-logger').get('login')
let R = require('ramda')
let immstruct = require('immstruct')

let {nbsp,} = require('../specialChars')
let ajax = require('../ajax')
let FocusingInput = require('./focusingInput')
let router = require('../router')
let validators = require('../validators')

if (__IS_BROWSER__) {
  require('./login.styl')
}

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
          ajax.postJson('/api/login', {
            username: loginCursor.get('emailOrUsername'),
            password: loginCursor.get('password'),
          }).then((user) => {
            logger.info(`User successfully logged in`)
            cursor = cursor.set('loggedInUser', immutable.fromJS(user))
            let redirectTo = cursor.get(`redirectToAfterLogin`)
            if (redirectTo != null) {
              logger.debug(`Redirecting to ${redirectTo} after having logged in`)
              cursor = cursor.delete(`redirectToAfterLogin`)
              router.goTo(redirectTo)
            } else {
              router.perform()
            }
          }, () => {
            logger.warn(`Logging user in failed`)
          })
        },
      }),
      h('a#forgot-password.small', {href: '/account/forgotpassword',}, 'Forgot password?'),
    ]),
  ])
})

let updateFieldState = (names, ErrorType, event) => {
  if (!R.isArrayLike(names)) {
    names = [names,]
  }
  let name = names[0]
  logger.debug(`Setting signup field '${name}': '${event.target.value}'`)

  let cursor = immstruct.instance('state').reference().cursor()
  let signupCursor = cursor.cursor(['login', 'signup',])
  let remainingValues = R.map((property) => {
    return signupCursor.get(property)
  }, names.slice(1))
  logger.debug(`Remaining values: '${remainingValues}'`)
  let validation = new ErrorType(R.concat([event.target.value,], remainingValues))
  if (validation.isInvalid) {
    logger.debug(`Signup field '${name}' is invalid: '${validation.errorText}'`)
  } else {
    logger.debug(`Signup field '${name}' is valid`)
    validation = null
  }

  signupCursor = signupCursor.update((current) => {
    current = current.set(name, event.target.value)
    if (validation != null) {
      logger.debug(`Updating error state for field '${name}':`, validation)
      current = current.setIn(['errors', name,], validation)
    } else {
      logger.debug(`Removing validation error for field '${name}'`)
      current = current.deleteIn(['errors', name,])
    }

    return current
  })

  logger.debug(`After updating signup:`, signupCursor.toJS())
}

let SignUpForm = component('SignUpForm', (cursor) => {
  let errors = cursor.cursor(['login', 'signup', 'errors',]).toJS()
  return h('form#signup-form.pure-form.pure-form-stacked', {
    action: 'action',
  }, [
    h('#userhint', [
      !R.isEmpty(errors) ? h('#submittedWithErrors',
        'There are errors in your form') : null,
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
          onChange: R.partial(updateFieldState, ['username',
            validators.InvalidUsername,]),
        }),
      ]),
      h('span.form-error-message',
        errors.username != null ? errors.username.errorText : null
      ),
      h('.required', [
        h('input.account-password', {
          type: 'password',
          'placeholder': 'password',
          required: true,
          onChange: R.partial(updateFieldState, ['password',
            validators.InvalidPassword,]),
        }),
      ]),
      h('span.form-error-message',
        errors.password != null ? errors.password.errorText : null
      ),
      h('.required', [
        h('input.account-password-confirm', {
          type: 'password',
          placeholder: 'confirm password',
          required: true,
          onChange: R.partial(updateFieldState, [['passwordConfirm',
            'password',], validators.InvalidPasswordConfirm,]),
        }),
      ]),
      h('span.form-error-message',
        errors.passwordConfirm != null ? errors.passwordConfirm.errorText : null
      ),
      h('.required', [
        h('input#signup-email.account-email', {
          autofocus: true,
          type: 'email',
          placeholder: 'email',
          required: true,
          onChange: R.partial(updateFieldState, ['email', validators.InvalidEmail,]),
        }),
      ]),
      h('.required', [
        h('input#signup-name.account-name', {
          autofocus: true,
          type: 'text',
          placeholder: 'name',
          required: true,
          onChange: R.partial(updateFieldState, ['name', validators.InvalidName,]),
        }),
      ]),
      h('input#signup-website.account-website', {
        autofocus: true,
        type: 'url',
        placeholder: 'website',
        // TODO
        onChange: R.partial(updateFieldState, ['website', validators.InvalidWebsite,]),
      }),
    ]),
    h('.button-group', [
      h('input#signup-button.pure-button.pure-button-primary', {
        type: 'submit',
        value: 'Sign up',
        onClick: (event) => {
          event.preventDefault()

          let signupCursor = cursor.cursor(['login', 'signup',])
          logger.debug(`Signing user up`)

          if (R.isEmpty(errors)) {
            let data = R.pick([
              'username', 'password', 'email', 'name', 'website',
            ], signupCursor.toJS())
            if (signupCursor.get('passwordConfirm') !== data.password) {
              throw new Error(`Passwords don't match`)
            }

            logger.debug(`Signing up new user:`, data)
            cursor.cursor('router').set('isLoading', true)
            ajax.postJson('/api/signup', data)
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
                router.perform()
              }, (err) => {
                logger.warn(`User signup failed: '${err}'`)
                cursor.cursor('router').set('isLoading', false)
              })
            } else {
              logger.debug(`There are errors in the form:`, errors)
            }
        },
      }),
    ]),
  ])
})

module.exports = {
  shouldRenderServerSide: false,
  redirectIfLoggedIn: true,
  render (cursor) {
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
  createState: () => {
    return immutable.fromJS({
      activeTab: 'signIn',
      signup: {
        errors: {},
      },
    })
  },
}
