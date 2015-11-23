'use strict'
let Hapi = require('hapi')
let R = require('ramda')
let path = require('path')
let jade = require('jade')
let immstruct = require('immstruct')
let Boom = require('boom')
let Logger = require('js-logger-aknudsen')
let logger = Logger.get('server')
Logger.useDefaults()

let auth = require('./server/auth')
let api = require('./server/api')
let rendering = require('./server/rendering')

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
    engines: { jade, },
    path: __dirname + '/templates',
    compileOptions: {
      pretty: true,
    },
  })

  server.route({
    method: ['GET',],
    path: '/{path*}',
    handler: (request, reply) => {
      logger.debug(`Rendering index file`)
      rendering.getInitialState(request)
        .then(([initialState, cursor,]) => {
          logger.debug(`Successfully loaded initial state:`, initialState)
          let reactHtml = rendering.render(cursor, request)
          reply.view('index', {
            initialState: JSON.stringify(initialState),
            reactHtml,
          })
        }, (error) => {
          logger.error(`Failed to load initial state: '${error}':`, error.stack)
          reply(Boom.badImplementation())
        })
        .catch((error) => {
          logger.error(`Rendering failed:`, error)
          reply(Boom.badImplementation())
        })
    },
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

  api.register(server)

  server.start(() => {
    logger.info('Server running at', server.info.uri);
  })
})
