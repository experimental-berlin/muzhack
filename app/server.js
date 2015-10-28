'use strict'
let FalcorServer = require('falcor-hapi')
let Hapi = require('hapi')
let Router = require('falcor-router')
let R = require('ramda')
let Path = require('path')

let server = new Hapi.Server({
  connections: {
    routes: {
      files: {
        relativeTo: Path.join(__dirname, 'public'),
      },
    },
  },
})
server.connection({
  host: 'localhost',
  port: 8000,
})

server.register(R.map((x) => {return require(x)}, ['inert',]), (err) => {
  if (err != null) {
    throw err
  }

  server.route({
    method: ['GET',],
    path: '/',
    handler: (request, reply) => {
      console.log('Reply')
      reply.file('index.html')
    },
  })
  // server.route({
  //   method: ['GET', 'POST', ],
  //   path: '/model.json',
  //   handler: FalcorServer.dataSourceRoute((req, res) => {
  //     return new Router([
  //       {
  //         route: 'greeting',
  //         get: () => {
  //           return {path: ['greeting', ], value: 'Hello World', }
  //         },
  //       },
  //     ])
  //   }),
  // })
  server.start(() => {
    console.log('Server running at', server.info.uri);
  })
})
