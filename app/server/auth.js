'use strict'
let bcrypt = require('bcrypt')
let Boom = require('boom')
let S = require('underscore.string.fp')
let logger = require('js-logger-aknudsen').get('auth')
let {withDb,} = require('./db')
let r = require('rethinkdb')
let R = require('ramda')

let logUserIn = (request, user) => {
  let username = request.payload.username
  request.auth.session.set({username: username, name: user.name,})
  logger.debug(`Successfully logged user '${username}' in`)
}

module.exports.getLoggedInUser = (request) => {
  if (request.auth.isAuthenticated) {
    return {
      username: request.auth.credentials.username,
    }
  } else {
    return null
  }
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

let resetPassword = (request, reply) => {
  logger.debug(`Handling request to reset password`)
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
            // TODO
          }
        })
    })
  }
}

module.exports.register = (server) => {
  server.register(require('hapi-auth-cookie'), (err) => {
    server.auth.strategy('session', 'cookie', 'try', {
      password: process.env.HAPI_IRON_PASSWORD,
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
      bcrypt.hash(payload.password, bcrypt.genSaltSync(), (err, hash) => {
        logger.debug(`Finished hashing`)
        if (err != null) {
          logger.error(`Hashing password failed: '${err}'`)
          reply(Boom.badImplementation())
        } else {
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
        }
      })
    },
  })
  server.route({
    method: ['POST',],
    path: '/api/resetPassword',
    handler: resetPassword,
  })
  server.route({
    method: ['GET',],
    path: '/api/logout',
    handler: (request, reply) => {
      logger.debug(`Logging user out`)
      request.auth.session.clear()
      reply()
    },
  })
}
