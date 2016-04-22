'use strict'
GLOBAL.__IS_BROWSER__ = false

let Hapi = require('hapi')
let R = require('ramda')
let path = require('path')
let pug = require('pug')
let immstruct = require('immstruct')
let Boom = require('boom')
let Logger = require('js-logger-aknudsen')
let logger = Logger.get('server')
Logger.useDefaults({
  formatter: (messages, context) => {
    messages.unshift(`${context.level.name} - [${context.name}]`)
  },
})

let auth = require('./server/auth')
let api = require('./server/api')
let rendering = require('./server/rendering')
let db = require('./server/db')

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

  server.views({
    engines: { jade: pug, },
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
      logger.error(`Failed to set up database`)
    })
})
