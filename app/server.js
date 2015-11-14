'use strict'
let Hapi = require('hapi')
let R = require('ramda')
let path = require('path')
let Logger = require('js-logger-aknudsen')
Logger.useDefaults()
let logger = Logger.get('server')

let auth = require('./server/auth')
let api = require('./server/api')

let server = new Hapi.Server({
  connections: {
    routes: {
      files: {
        relativeTo: path.join(__dirname, 'public'),
      },
    },
  },
})
server.connection({
  host: '0.0.0.0',
  port: parseInt(process.env.PORT || '8000'),
})

auth.register(server)

server.register(R.map((x) => {return require(x)}, ['inert',]), (err) => {
  if (err != null) {
    throw err
  }

  server.route({
    method: ['GET',],
    path: '/{path*}',
    handler: {
      file: 'index.html',
    },
  })
  server.route({
    method: ['GET',],
    path: '/bundle.js',
    handler: {
      file: path.join(__dirname, '../dist/bundle.js'),
    },
  })

  api.register(server)

  server.start(() => {
    logger.info('Server running at', server.info.uri);
  })
})
