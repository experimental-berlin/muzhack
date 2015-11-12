'use strict'
let Hapi = require('hapi')
let Router = require('falcor-router')
let R = require('ramda')
let path = require('path')
let Logger = require('js-logger-aknudsen')
Logger.useDefaults()
let logger = Logger.get('server')
let moment = require('moment')
let AwsS3Form = require('aws-s3-form')

let auth = require('./server/auth')

let s3Directives = {
  pictures: {},
  'pictures-backup': {},
  files: {},
  'files-backup': {},
}

let licenses = {
  'cc-by-4.0': {
    id: 'cc-by-4.0',
    name: 'Creative Commons',
    url: 'http://creativecommons.org',
    icons: [
      'creative-commons',
      'creative-commons-attribution',
    ],
  },
}

class Project {
  constructor({projectId, tags, owner, ownerName, title, created, pictures, license,
      description, instructions, files, zipFile,}) {
    this.projectId = projectId
    this.tags = tags
    this.owner = owner
    this.ownerName = ownerName
    this.title = title
    this.created = created
    this.pictures = pictures
    this.license = license
    this.description = description
    this.instructions = instructions
    this.files = files
    this.zipFile = zipFile
  }
}

let projects = {
  'aknudsen/test': new Project({
   projectId: 'test',
   tags: ['notam', '3dprint',],
   owner: 'aknudsen',
   ownerName: 'Arve Knudsen',
   title: 'Test',
   created: '2015-11-04',
   pictures: [],
   license: licenses['cc-by-4.0'],
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
 }),
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
      let qualifiedProjectId = `${owner}/${projectId}`
      logger.debug(`Getting project '${qualifiedProjectId}'`)
      let project = projects[qualifiedProjectId]
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
    config: {
      auth: 'session',
      handler: (request, reply) => {
        let {directive,} = request.params
        let {key, isBackup,} = request.query
        logger.debug(`Getting S3 form data for directive '${directive}'`)

        let bucket = !isBackup ? process.env.S3_BUCKET : `backup.${process.env.S3_BUCKET}`
        let keyPrefix = `u/${request.auth.credentials.username}/`
        let region = process.env.S3_REGION
        let s3Form = new AwsS3Form({
          accessKeyId: process.env.AWS_ACCESS_KEY,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
          region,
          bucket,
          keyPrefix,
          successActionStatus: 200,
        })
        let url = `https://s3.${region}.amazonaws.com/${bucket}/${keyPrefix}${key}`
        logger.debug(`S3 URL to file:`, url)
        let formData = s3Form.create(key)
        reply({
          bucket,
          url,
          fields: formData.fields,
        })
      },
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
  server.route({
    method: ['POST',],
    path: '/api/projects',
    config: {
      auth: 'session',
      handler: (request, reply) => {
        let projectParams = request.payload
        logger.debug(`Received request to create project:`, projectParams)
        let qualifiedProjectId = `${request.auth.credentials.username}/${projectParams.id}`
        projectParams.projectId = projectParams.id
        projectParams.license = licenses[projectParams.license]
        projects[qualifiedProjectId] = new Project(R.merge(projectParams, {
          owner: request.auth.credentials.username,
          ownerName: request.auth.credentials.name,
          zipFile: 'TODO',
          created: moment.utc().format(),
        }))
        logger.debug('Projects:', projects)
        reply()
      },
    },
  })

  server.start(() => {
    logger.info('Server running at', server.info.uri);
  })
})
