'use strict'
let bcrypt = require('bcrypt')
let Boom = require('boom')
let S = require('underscore.string.fp')
let logger = require('js-logger').get('auth')

let users = {
  aknudsen: {
    password: bcrypt.hashSync('password', bcrypt.genSaltSync()),
    name: 'John Doe',
    projects: [],
  },
}

module.exports.getLoggedInUser = (request) => {
  return request.auth.isAuthenticated ? {
    username: request.auth.credentials.name,
  } : null
}

let validateSignUp = (request, reply) => {
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
    handler: (request, reply) => {
      logger.debug(`Handling request to log user in`)
      if (request.payload.username == null || request.payload.password == null) {
        logger.debug(`Username or password is missing`)
        reply(Boom.badRequest('Missing username or password'))
      } else {
        let account = users[request.payload.username]
        if (account == null) {
          logger.debug('User not found')
          reply(Boom.badRequest('Invalid username or password'))
        } else {
          if (request.auth.isAuthenticated) {
            logger.debug(`User is already logged in`)
            reply({username: request.payload.username,})
          } else {
            logger.debug(`Logging user in`)
            bcrypt.compare(request.payload.password, account.password, (err, isValid) => {
              if (!isValid) {
                logger.debug(`Password not valid`)
                reply(Boom.badRequest('Invalid username or password'))
              } else {
                let result = {username: request.payload.username,}
                logger.debug(`User successfully logged in - replying with:`, result)
                request.auth.session.set(account)
                reply(result)
              }
            })
          }
        }
      }
    },
  })
  server.route({
    method: ['POST',],
    path: '/api/signup',
    handler: (request, reply) => {
      logger.debug(`Handling request to sign user up`)
      if (!validateSignUp(request, reply)) {
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
            username: payload.username,
            email: payload.username,
            name: payload.name,
            password: hash,
            website: payload.website,
          }
          users[payload.username] = user
          request.auth.session.set(user)
          reply()
        }
      })
    },
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
