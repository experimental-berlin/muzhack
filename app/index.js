'use strict'
let FalcorServer = require('falcor-hapi')
let Hapi = require('hapi')
let Router = require('falcor-router')

let server = new Hapi.Server()
server.connection({
  host: 'localhost',
  port: 8000,
})

server.route({
  method: ['GET', 'POST', ],
  path: '/model.json',
  handler: FalcorServer.dataSourceRoute((req, res) => {
    return new Router([
      {
        route: 'greeting',
        get: () => {
          return {path: ['greeting', ], value: 'Hello World', }
        },
      },
    ])
  }),
})
server.start(() => {

})
