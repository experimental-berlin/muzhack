'use strict'
global.__IS_BROWSER__ = false

let Hapi = require('hapi')
let R = require('ramda')
let path = require('path')
let pug = require('pug')
let Boom = require('boom')
let moment = require('moment')
let r = require('rethinkdb')
let Url = require('url')
let Promise = require('bluebird')
let Logger = require('@arve.knudsen/js-logger')
let logger = Logger.get('server')
Logger.useDefaults({
  formatter: (messages, context) => {
    let time = moment.utc().format('HH:mm:ss')
    messages.unshift(`${context.level.name} ${time} - [${context.name}]`)
  },
})
Logger.setHandler((messages, context) => {
  Logger.getDefaultHandler()(messages, context)

  if (context.level === Logger.ERROR) {
    let appUri = getEnvParam('APP_URI')
    let emailAddress = `contact@muzhack.com`
    let reason = messages[0]
    let error = messages[1]
    let message
    if (error == null) {
      let stack = new Error().stack.replace(/\n/g, '<br>')
      message = `${reason}<br><br>

Traceback:
${stack}
`
    } else {
      let stack = error.stack != null ? error.stack : error
      message = stack.replace(/\n/g, '<br>')
    }

    let dateTimeStr = moment.utc().format('YYYY-MM-DD HH:mm:ss')
    logger.debug(`Reporting error by email to '${emailAddress}'...`)
    emailer.sendEmail({
      emailAddress, name: `MuzHack Admin`,
      subject: `Error Detected in MuzHack at ${appUri}`,
      html: `<p>${dateTimeStr} - an error was detected in MuzHack, at ${appUri}</p>

  <blockquote>
  ${message}
  </blockquote>
  `,
    })
  }
})

let auth = require('./server/auth')
let api = require('./server/api')
let workshopsServerApi = require('./server/workshopsServerApi')
let rendering = require('./server/rendering')
let workshopsServerRendering = require('./server/workshopsServerRendering')
let db = require('./server/db')
let {getEnvParam,} = require('./server/environment')
let emailer = require('./server/emailer')
let ajax = require('./ajax')

let isProduction = getEnvParam('NODE_ENV', '').toLowerCase() === 'production'
if (isProduction) {
  Logger.setLevel(Logger.WARN)
}

process.on('uncaughtException', (error) => {
  logger.error(`An uncaught exception occurred`, error.stack)
})

Promise.config({
  longStackTraces: true,
  cancellation: true,
})

let appEnvironment = getEnvParam('APP_ENVIRONMENT')

let standardVHost
if (appEnvironment === 'production') {
  standardVHost = 'muzhack.com'
} else if (appEnvironment === 'staging') {
  standardVHost = 'staging.muzhack.com'
} else if (appEnvironment === 'local') {
  standardVHost = `localhost`
} else {
  throw new Error(`Unrecognized app environment '${appEnvironment}'`)
}
let workshopsVHost = `workshops.${standardVHost}`

let setUpServer = Promise.method(() => {
  let server = new Hapi.Server({
    connections: {
      router: {
        stripTrailingSlash: true,
      },
      routes: {
        files: {
          relativeTo: path.join(__dirname, '../public'),
        },
      },
    },
  })
  let port = parseInt(process.env.PORT || '8000')
  server.connection({
    host: '0.0.0.0',
    port,
  })

  auth.register(server, standardVHost, workshopsVHost)
  let plugins = R.map((x) => {return require(x)}, ['inert', 'vision',])
  return Promise.promisify(server.register, {context: server,})(plugins)
    .then(() => {
      server.ext('onRequest', (request, reply) => {
        // GKE health check
        if ((request.headers['user-agent'] || '').toLowerCase().startsWith('googlehc')) {
          return reply('Healthy')
        } else {
          if (request.headers['x-forwarded-proto'] === 'http') {
            logger.debug(`Redirecting to HTTPS, using $APP_URI: ${process.env.APP_URI}`)
            return reply.redirect(Url.format({
              protocol: 'https',
              hostname: Url.parse(process.env.APP_URI).hostname,
              pathname: request.url.path,
              port: 443,
            }))
          } else {
            logger.debug(`Not redirecting to HTTPS`)
            reply.continue()
          }
        }
      })

      server.views({
        engines: {pug,},
        path: __dirname + '/templates',
        compileOptions: {
          pretty: true,
        },
      })

      return server
    })
})

setUpServer()
  .then((server) => {
    let routeServerMethod = (options) => {
      if (typeof options.handler === 'function') {
        let originalHandler = options.handler
        options.handler = (request, reply) => {
          Promise.method(originalHandler)(request, reply)
            .catch((error) => {
              logger.error(`An unhandled error occurred:`, error.stack)
              reply(Boom.badImplementation())
            })
        }
      }
      server.route(R.merge({
        method: `GET`,
        vhost: [standardVHost, workshopsVHost,],
      }, options))
    }

    routeServerMethod({
      path: '/u/{user}/attach/github',
      handler: (request, reply) => {
        let username = request.params.user
        let {code, state,} = request.query
        // TODO: Verify that state corresponds to what we initiated the OAuth token request with
        let clientId = getEnvParam('GITHUB_CLIENT_ID')
        let clientSecret = getEnvParam('GITHUB_CLIENT_SECRET')
        logger.debug(`Requesting OAuth data from GitHub for user '${username}'`)
        return ajax.getJson(`https://github.com/login/oauth/access_token?` +
            `client_id=${clientId}&client_secret=${clientSecret}&state=${state}&code=${code}`)
          .then((accessTokenData) => {
            let accessToken = accessTokenData.access_token
            logger.debug(`Received OAuth data from GitHub for user '${username}'`)
            return ajax.getJson(`https://api.github.com/user`, null, {
              headers: {Authorization: `token ${accessToken}`,},
            })
              .then((accountData) => {
                return db.connectToDb()
                  .then((conn) => {
                    logger.debug(
                      `Updating user '${username}' with GitHub access token and username:`, {
                      accessToken,
                      login: accountData.login,
                    })
                    return r.table('users')
                      .get(username)
                      .update({
                        'gitHubAccessToken': accessToken,
                        'gitHubAccount': accountData.login,
                      })
                      .run(conn)
                      .then(() => {
                        let redirectUrl = `${getEnvParam('APP_URI')}/u/${username}`
                        logger.debug(`Redirecting to ${redirectUrl}`)
                        reply.redirect(redirectUrl)
                      })
                      .finally(() => {
                        db.closeDbConnection(conn)
                      })
                  })
              }, (error) => {
                logger.warn(`Failed to obtain GitHub user data:`, error.stack)
                throw error
              })
          }, (error) => {
            logger.warn(`Failed to obtain GitHub access token:`, error)
            reply(Boom.badRequest(`Couldn't get GitHub access token`))
          })
      },
    })
    routeServerMethod({
      path: '/{path*}',
      handler: rendering.renderIndex,
      vhost: standardVHost,
    })
    routeServerMethod({
      path: '/muzhack.bundle.js',
      handler: {
        file: {
          path: path.join(__dirname, '../muzhack.bundle.js'),
          confine: false,
        },
      },
    })
    routeServerMethod({
      path: '/assets/{param*}',
      handler: {
        directory: {
          path: '.',
          redirectToSlash: true,
          listing: true,
        },
      },
    })
    routeServerMethod({
      path: '/robots.txt',
      handler: (request, reply) => {
        if (isProduction) {
          reply(`User-agent: *\nDisallow: /`).header('Content-Type', 'text/plain')
        } else {
          reply()
        }
      },
    })
    routeServerMethod({
      path: '/google7ffea6639eea1b0a.html',
      handler: (request, reply) => {
        reply(`google-site-verification: google7ffea6639eea1b0a.html`)
          .header('Content-Type', 'text/plain')
      },
    })

    routeServerMethod({
      path: '/{path*}',
      handler: workshopsServerRendering.renderIndex,
      vhost: workshopsVHost,
    })

    api.register(server, standardVHost, workshopsVHost)
    workshopsServerApi.register(server, standardVHost, workshopsVHost)

    db.setUp()
      .then(() => {
        server.start((err) => {
          if (err != null) {
            logger.error(`Failed to start server: ${err}`)
            process.exit(1)
          } else {
            logger.info('Server running at', server.info.uri)
          }
        })
      }, (error) => {
        logger.error(`Failed to set up database: '${error}'`)
        throw error
      })
})
