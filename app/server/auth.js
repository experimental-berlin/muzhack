'use strict'
let bcrypt = require('bcrypt')
let Boom = require('boom')
let S = require('underscore.string.fp')
let logger = require('js-logger-aknudsen').get('auth')
let {withDb,} = require('./db')
let r = require('rethinkdb')
let R = require('ramda')
let mandrill = require('mandrill-api/mandrill')
let base64url = require('base64url')
let crypto = require('crypto')
let moment = require('moment')

let {getEnvParam,} = require('./environment')

let logUserIn = (request, user) => {
  let username = user.id
  request.auth.session.set({username, name: user.name,})
  logger.debug(`Successfully logged user '${username}' in`)
}

let validateSignup = (request, reply) => {
  let {username, password, email, name, website,} = request.payload
  let message
  if (S.isBlank(username)) {
    message = 'Missing username'
  } else if (S.isBlank(password)) {
    message = 'Missing password'
  } else if (S.isBlank(email)) {
    message = 'Missing email'
  } else if (S.isBlank(name)) {
    message = 'Missing name'
  }

  if (message != null) {
    reply(Boom.badRequest(message))
    return false
  }

  return true
}

let logIn = (request, reply) => {
  logger.debug(`Handling request to log user in`)
  if (request.payload.username == null || request.payload.password == null) {
    logger.debug(`Username or password is missing`)
    reply(Boom.badRequest('Missing username or password'))
  } else {
    withDb(reply, (conn) => {
      let usernameOrEmail = request.payload.username
      return r.table('users')
        .filter((user) => {
          return user('id').eq(usernameOrEmail).or(user('email').eq(usernameOrEmail))
        }).run(conn)
        .then((cursor) => {
          return cursor.toArray()
            .then((users) => {
              if (R.isEmpty(users)) {
                logger.debug(
                  `Could not find user with username or email '${usernameOrEmail}'`)
                return Boom.badRequest('Invalid username or password')
              } else {
                let user = users[0]
                logger.debug(`Users:`, users)
                if (request.auth.isAuthenticated) {
                  logger.debug(`User is already logged in`)
                  return {username: user.username,}
                } else {
                  logger.debug(`Logging user in`)
                  return new Promise((resolve, reject) => {
                    bcrypt.compare(request.payload.password, user.password, (err, isValid) => {
                      if (!isValid) {
                        logger.debug(`Password not valid`)
                        reject(Boom.badRequest('Invalid username or password'))
                      } else {
                        logUserIn(request, user)
                        let result = {username: user.username,}
                        logger.debug(`User successfully logged in - replying with:`, result)
                        resolve(result)
                      }
                    })
                  })
                }
              }
            })
        })
    })
  }
}

let pruneResetPasswordTokens = (user, conn) => {
  logger.debug(`Pruning old reset password tokens`)
  return r.table('resetPasswordTokens')
    .filter((token) => {
      return token('username').eq(user.username).or(token('expires').date().lt(r.now().date()))
    })
    .delete()
    .run(conn)
}

let issueResetPasswordLink = (user, conn) => {
  return new Promise((resolve, reject) => {
    crypto.randomBytes(48, function(error, buf) {
      if (error == null) {
        resolve(base64url(buf))
      } else {
        reject(error)
      }
    })
  })
    .then((token) => {
      let expires = moment().utc().add(24, 'hours').format()
      let username = user.username
      logger.debug(
        `Storing reset password token for user '${username}' with expiration ${expires}:
${token}`)
      return r.table('resetPasswordTokens')
        .get(token)
        .replace({
          id: token,
          expires,
          username,
        })
        .run(conn)
        .then(() => {
          let mandrillClient = new mandrill.Mandrill(getEnvParam('MANDRILL_SECRET'))
          return new Promise((resolve, reject) => {
            let email = user.email
            let appUrl = getEnvParam('APP_URL')
            logger.debug(`Sending email to '${user.email}' with password reset link...`)
            let url = `${appUrl}/account/resetpassword/${token}"`
            let message = {
              html: `<p>Hello ${user.name},</p>

<p>
To reset your password, simply click the link below.
</p>

<p>
<a href="${url}">${url}</a>
</p>

<p>
Thanks.
</p>
`,
              subject: `How to reset your password on muzhack.com`,
              from_email: `contact@muzhack.com`,
              from_name: `MuzHack`,
              to: [{
                email,
                name: user.name,
                type: 'to',
              },],
              headers: {
                'Reply-To': `no-reply@muzhack.com`,
              },
            }
            mandrillClient.messages.send({
              message: message,
              async: true,
            }, () => {
              logger.debug(`Sent email to '${email}' successfully`)
              resolve()
            }, (error) => {
              reject(`A Mandrill error occurred: '${error.message}'`)
            })
          })
        })
    })
}

let forgotPassword = (request, reply) => {
  logger.debug(`Handling forgot password request`)
  if (request.payload.username == null) {
    logger.debug(`Username is missing`)
    reply(Boom.badRequest('Missing username'))
  } else {
    withDb(reply, (conn) => {
      let usernameOrEmail = request.payload.username
      return r.table('users')
        .filter((user) => {
          return user('id').eq(usernameOrEmail).or(user('email').eq(usernameOrEmail))
        }).run(conn)
        .then((cursor) => {return cursor.toArray()})
        .then((users) => {
          if (R.isEmpty(users)) {
            logger.debug(`Could not find user with username or email '${usernameOrEmail}'`)
            return Boom.badRequest('Invalid username or password')
          } else {
            let user = users[0]
            return pruneResetPasswordTokens(user, conn)
              .then(() => {
               return issueResetPasswordLink(user, conn)
             })
          }
        })
    })
  }
}

let setUserPassword = (user, password, conn) => {
  logger.debug(`Setting password of user '${user.username}'`)
  return hashPassword(password)
    .then((hash) => {
      return r.table('users')
        .get(user.username)
        .update({
          password: hash,
        })
        .run(conn)
        .then(() => {
          logger.debug(`Successfully reset password of user '${user.username}'`)
        })
    })
}

let resetPassword = (request, reply) => {
  let token = request.params.token
  logger.debug(`Handling password reset request, token: '${token}'`)
  withDb(reply, (conn) => {
    return r.table('resetPasswordTokens')
      .get(token)
      .run(conn)
      .then((obj) => {
        if (obj == null) {
          logger.debug(`Could not find password reset object with token '${token}'`)
          return Boom.badRequest('Invalid token')
        } else {
          let expires = moment(obj.expires)
          if (moment().utc().diff(expires) > 0) {
            logger.debug(`Token '${token}' has expired, '${expires}':`, moment().utc().diff(expires))
            return Boom.badRequest('Expired token')
          } else {
            logger.debug(`Password reset token has not expired:`, expires.format())
            return r.table('users')
              .get(obj.username)
              .run(conn)
              .then((user) => {
                if (user == null) {
                  logger.debug(`No user corresponding to password reset token '${token}'`)
                  return Boom.badRequest('Expired token')
                } else {
                  return setUserPassword(user, request.payload.password, conn)
                    .then(() => {
                      return pruneResetPasswordTokens(user, conn)
                        .then(() => {
                          logUserIn(request, user)
                        })
                    })
                }
              })
          }
        }
      })
  })
}

let hashPassword = (password) => {
  return new Promise((resolve, reject) => {
    bcrypt.hash(password, bcrypt.genSaltSync(), (err, hash) => {
      logger.debug(`Finished hashing password`)
      if (err != null) {
        logger.error(`Hashing password failed: '${err}'`)
        reject(err)
      } else {
        resolve(hash)
      }
    })
  })
}

module.exports.register = (server) => {
  server.register(require('hapi-auth-cookie'), (err) => {
    server.auth.strategy('session', 'cookie', 'try', {
      password: getEnvParam('HAPI_IRON_PASSWORD'),
      isSecure: false,
    })
  })

  server.route({
    method: ['POST',],
    path: '/api/login',
    handler: logIn,
  })
  server.route({
    method: ['POST',],
    path: '/api/signup',
    handler: (request, reply) => {
      logger.debug(`Handling request to sign user up`)
      if (!validateSignup(request, reply)) {
        return
      }

      let payload = request.payload
      logger.debug(`Generating hash...`)
      hashPassword(payload.password)
        .then((hash) => {
          logger.debug(`Successfully registered user '${payload.username}'`)
          let user = {
            id: payload.username,
            username: payload.username,
            email: payload.email,
            name: payload.name,
            password: hash,
            website: payload.website || null,
            projects: [],
            projectPlans: [],
            about: payload.about || null,
          }
          withDb(reply, (conn) => {
            return r.table('users')
              .insert(user, {
                conflict: 'error',
              })
              .run(conn)
              .then((result) => {
                if (result.errors > 0) {
                  if (result.first_error.startsWith('Duplicate primary key')) {
                    logger.debug(
                      `User's requested username is already taken: '${payload.username}'`)
                    return Boom.badRequest('Username is taken')
                  } else {
                    logger.debug(
                      `An error was encountered while adding new user: '${result.first_error}'`)
                    return Boom.badImplementation()
                  }
                } else {
                  logUserIn(request, user)
                }
              })
          })
        }, (err) => {
          reply(Boom.badImplementation())
        })
    },
  })
  server.route({
    method: ['POST',],
    path: '/api/forgotPassword',
    handler: forgotPassword,
  })
  server.route({
    method: ['POST',],
    path: '/api/resetPassword/{token}',
    handler: resetPassword,
  })
  server.route({
    method: ['GET',],
    path: '/api/logout',
    handler: (request, reply) => {
      logger.debug(`Logging user out`)
      if (request.auth.session != null) {
        request.auth.session.clear()
      }
      reply()
    },
  })
}
