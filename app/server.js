'use strict'
let Hapi = require('hapi')
let Router = require('falcor-router')
let R = require('ramda')
let path = require('path')
let Logger = require('js-logger-aknudsen')
Logger.useDefaults()
let logger = Logger.get('server')
let s3Policy = require('s3-policy')

let auth = require('./server/auth')

let s3Directives = {
  pictures: {},
  'pictures-backup': {},
  files: {},
  'files-backup': {},
}

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
  server.route({
    method: ['GET',],
    path: '/api/users/{username}',
    handler: (request, reply) => {
      let {username,} = request.params
      logger.debug(`Getting user '${username}'`)
      let user = {
        username,
        name: 'Arve Knudsen',
        email: 'arve.knudsen@gmail.com',
        projects: [],
        projectPlans: [],
        about: 'Arve is one **cool** guy.',
        soundCloudUploads: [],
        workshopsInfo: `#Arve Knudsen\'s workshop profile

Arve has no workshops planned at this moment.`,
      }
      logger.debug(`Returning user:`, user)
      reply(user)
    },
  })
  server.route({
    method: ['GET',],
    path: '/api/s3Settings/{directive}',
    handler: (request, reply) => {
      let {directive,} = request.params
      let {key,} = request.query
      logger.debug(`Getting S3 settings for directive '${directive}'`)

      let bucket = process.env.S3_BUCKET
      let {policy, signature,} = s3Policy({
        secret: process.env.AWS_SECRET_ACCESS_KEY,
        length: 5*1024*104,
        bucket,
        key,
        expires: new Date(Date.now() + 60000),
        // acl: 'public-read',
      })
      let settings = {
        bucket,
        awsAccessKey: process.env.AWS_ACCESS_KEY,
        policy,
        signature,
      }
      logger.debug(`Returning settings:`, settings)
      reply(settings)
    },
  })
  server.route({
    method: ['POST',],
    path: '/api/logError',
    handler: (request, reply) => {
      let error = request.payload.error
      logger.warn(`An error was logged on a client: ${error}`)
      reply()
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
