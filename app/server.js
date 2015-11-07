'use strict'
let Hapi = require('hapi')
let Router = require('falcor-router')
let R = require('ramda')
let path = require('path')
let Logger = require('js-logger')
Logger.useDefaults()
let logger = Logger.get('server')

let auth = require('./server/auth')

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
  server.route({
    method: ['GET',],
    path: '/api/initialData',
    handler: (request, reply) => {
      logger.debug(`Getting initial data`)
      reply({
        user: auth.getLoggedInUser(request),
      })
    },
  })
  server.route({
    method: ['GET',],
    path: '/api/search',
    handler: (request, reply) => {
      logger.debug(`Searching for '${request.query.query}'`)
      let re = new RegExp(request.query.query, 'i')
      reply(R.filter((x) => {return re.test(x.projectId) || re.test(x.title) || re.test(x.owner)}, [
        {
          projectId: 'test',
          title: 'Test',
          owner: 'aknudsen',
        },
      ]))
    },
  })
  server.route({
    method: ['GET',],
    path: '/api/projects/{owner}/{projectId}',
    handler: (request, reply) => {
      let {owner, projectId,} = request.params
      logger.debug(`Getting project '${owner}/${projectId}'`)
      let project = {
        projectId,
        tags: ['notam', '3dprint',],
        owner,
        ownerName: 'Arve Knudsen',
        title: 'Test',
        created: '2015-11-04',
        pictures: [],
        license: {
          name: 'Creative Commons',
          url: 'http://creativecommons.org',
          icons: [
            'creative-commons',
            'creative-commons-attribution',
          ],
        },
        description: `#Description`,
        instructions: `#Instructions`,
        files: [
          {
            url: 'example.com',
            fullPath: 'file.txt',
            size: 20,
          },
        ],
        zipFile: {
          size: 80,
          url: 'example.com',
        },
      }
      logger.debug(`Returning project:`, project)
      reply(project)
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
    logger.info('Server running at', server.info.uri);
  })
})
auth.register(server)
