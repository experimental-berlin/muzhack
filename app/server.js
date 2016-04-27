'use strict'
GLOBAL.__IS_BROWSER__ = false

let Hapi = require('hapi')
let R = require('ramda')
let path = require('path')
let pug = require('pug')
let immstruct = require('immstruct')
let Boom = require('boom')
let moment = require('moment')
let Url = require('url')
let Logger = require('js-logger-aknudsen')
let logger = Logger.get('server')
Logger.useDefaults({
  formatter: (messages, context) => {
    let time = moment().format('HH:mm:ss')
    messages.unshift(`${context.level.name} ${time} - [${context.name}]`)
  },
})
Logger.setHandler((messages, context) => {
  Logger.getDefaultHandler()(messages, context)

  if (context.level === Logger.ERROR) {
    let appUrl = getEnvParam('APP_URL')
    let emailAddress = `contact@muzhack.com`
    logger.debug(`Reporting error by email to '${emailAddress}'...`)
    emailer.sendEmail({
      emailAddress, name: `MuzHack Admin`,
      subject: `Error Detected in MuzHack at ${appUrl}`,
      html: `<p>An error was detected in MuzHack, at ${appUrl}</p>

  <blockquote>
  ${messages[0]}
  </blockquote>
  `,
    })
  }
})

let auth = require('./server/auth')
let api = require('./server/api')
let rendering = require('./server/rendering')
let db = require('./server/db')
let {getEnvParam,} = require('./server/environment')
let emailer = require('./server/emailer')

let server = new Hapi.Server({
  connections: {
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

if (process.env.MUZHACK_URI == null) {
  process.env.MUZHACK_URI = `http://localhost:${port}`
}

auth.register(server)

server.register(R.map((x) => {return require(x)}, ['inert', 'vision',]), (err) => {
  if (err != null) {
    throw err
  }

  server.ext('onRequest', (request, reply) => {
    // GKE health check
    if (request.headers['user-agent'].toLowerCase().startsWith('googlehc')) {
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
    engines: { pug, },
    path: __dirname + '/templates',
    compileOptions: {
      pretty: true,
    },
  })

  server.route({
    method: ['GET',],
    path: '/{path*}',
    handler: rendering.renderIndex,
  })
  server.route({
    method: ['GET',],
    path: '/bundle.js',
    handler: {
      file: path.join(__dirname, '../dist/bundle.js'),
    },
  })
  server.route({
    method: 'GET',
    path: '/assets/{param*}',
    handler: {
      directory: {
        path: '.',
        redirectToSlash: true,
        listing: true,
      },
    },
  })
  server.route({
    method: 'GET',
    path: '/robots.txt',
    handler: (request, reply) => {
      if ((process.env.NODE_ENV || '').toLowerCase() !== 'production') {
        reply(`User-agent: *\nDisallow: /`).header('Content-Type', 'text/plain')
      } else {
        reply()
      }
    },
  })

  api.register(server)

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
    })
})
