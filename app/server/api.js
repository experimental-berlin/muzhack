'use strict'
let logger = require('js-logger-aknudsen').get('server.api')
let AwsS3Form = require('aws-s3-form')
let Boom = require('boom')
let R = require('ramda')
let S = require('underscore.string.fp')
let moment = require('moment')
let r = require('rethinkdb')
let Aws = require('aws-sdk')

let auth = require('./auth')
let {withDb,} = require('./db')

class Project {
  constructor({projectId, tags, owner, ownerName, title, created, pictures, licenseId,
      description, instructions, files, zipFile,}) {
    this.projectId = projectId
    this.tags = tags
    this.owner = owner
    this.ownerName = ownerName
    this.title = title
    this.created = created
    this.pictures = pictures
    this.licenseId = licenseId
    this.description = description
    this.instructions = instructions
    this.files = files
    this.zipFile = zipFile
  }
}

let getS3Client = () => {
  return new Aws.S3({
    accessKeyId: process.env.AWS_ACCESS_KEY,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.S3_REGION,
    params: {
      Bucket: process.env.S3_BUCKET,
    },
  })
}

module.exports.register = (server) => {
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
      withDb(reply, (conn) => {
        return r.table('projects').filter((x) => {
          // TODO Fix
          return re.test(x.projectId) || re.test(x.title) || re.test(x.owner)
        }).run(conn)
          .then((projects) => {
            reply(projects.toArray())
          })
      })
    },
  })
  server.route({
    method: ['GET',],
    path: '/api/projects/{owner}/{projectId}',
    handler: (request, reply) => {
      let {owner, projectId,} = request.params
      let qualifiedProjectId = `${owner}/${projectId}`
      logger.debug(`Getting project '${qualifiedProjectId}'`)
      withDb(reply, (conn) => {
        return r.table('projects').get(qualifiedProjectId).run(conn)
          .then((project) => {
            if (project != null) {
              logger.debug(`Found project '${qualifiedProjectId}':`, project)
              reply(project)
            } else {
              logger.debug(`Could not find project '${qualifiedProjectId}'`)
              reply(Boom.notFound())
            }
          })
      })
    },
  })
  server.route({
    method: ['GET',],
    path: '/api/users/{username}',
    handler: (request, reply) => {
      let {username,} = request.params
      withDb(reply, (conn) => {
        logger.debug(`Getting user '${username}'`)
        return r.table('users').get(username).run(conn)
          .then((user) => {
            if (user != null) {
              logger.debug(`Found user '${username}':`, user)
              reply(user)
            } else {
              logger.debug(`Could not find user '${username}'`)
              reply(Boom.notFound())
            }
          })
      })
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
    path: '/api/projects/{owner}',
    config: {
      auth: 'session',
      handler: (request, reply) => {
        let projectParams = request.payload
        logger.debug(`Received request to create project:`, projectParams)
        let owner = request.params.owner
        if (owner !== request.auth.credentials.username) {
          logger.debug(`User tried to create project for other user`)
          reply(Boom.unauthorized(
            `You are not allowed to create projects for others than your own user`))
        } else {
          let qualifiedProjectId = `${owner}/${projectParams.id}`
          projectParams.projectId = projectParams.id
          let project = new Project(R.merge(projectParams, {
            owner: request.auth.credentials.username,
            ownerName: request.auth.credentials.name,
            created: moment.utc().format(),
            // TODO
            zipFile: {
              size: 0,
            },
          }))
          withDb(reply, (conn) => {
            logger.debug(`Creating project '${qualifiedProjectId}':`, project)
            return r.table('projects')
              .get(qualifiedProjectId)
              .replace(R.merge(project, {
                id: qualifiedProjectId,
              }))
              .run(conn)
              .then(() => {
                reply()
              })
          })
        }
      },
    },
  })
  server.route({
    method: ['PUT',],
    path: '/api/projects/{owner}/{id}',
    config: {
      auth: 'session',
      handler: (request, reply) => {
        let owner = request.params.owner
        if (owner !== request.auth.credentials.username) {
          reply(Boom.unauthorized(
            `You are not allowed to update projects for others than your own user`))
        } else {
          let projectParams = request.payload
          logger.debug(`Received request to update project:`, projectParams)
          let projectId = request.params.id
          let qualifiedProjectId = `${owner}/${projectId}`
          let s3Client = getS3Client()

          let removeStaleFiles = (oldFiles, newFiles, fileType) => {
            if (oldFiles == null) {
              logger.debug(`Project has no old ${fileType}s - nothing to remove`)
              return
            }

            let removedFiles = R.differenceWith(((a, b) => {
              return a.url === b.url
            }), oldFiles, newFiles)
            if (!R.isEmpty(removedFiles)) {
              logger.debug(
                `Removing ${removedFiles.length} stale ${fileType}(s) (type: ${fileType}), old
                files vs new files:`, oldFiles, newFiles)
            } else {
              logger.debug(`No ${fileType}s to remove`)
              return
            }

            let filePaths = R.map((file) => {
              let filePath = `u/${owner}/${projectId}/${fileType}s/${file.fullPath}`
              return filePath
            }, removedFiles)
            let filePathsStr = S.join(', ', filePaths)
            logger.debug(`Removing outdated ${fileType}s ${filePathsStr}`)
            return new Promise((resolve, reject) => {
              s3Client.deleteObjects({
                Delete: {
                  Objects: R.map((filePath) => {
                    return {
                      Key: filePath,
                    }
                  }, filePaths),
                },
              }, (error, data) => {
                if (error == null) {
                  resolve(data)
                } else {
                  reject(error)
                }
              })
            })
              .then(() => {
                logger.debug(`Successfully removed ${fileType}(s) ${filePathsStr}`)
              }, (error) => {
                logger.warn(`Failed to remove ${fileType}(s) ${filePathsStr}: '${error}'`)
              })
          }

          withDb(reply, (conn) => {
            return r.table('projects').get(qualifiedProjectId).run(conn)
              .then((project) => {
                let removeStalePromises = [
                  removeStaleFiles(project.pictures, projectParams.pictures, 'picture'),
                  removeStaleFiles(project.files, projectParams.files, 'file'),
                ]
                return Promise.all(removeStalePromises)
                  .then(() => {
                    logger.debug(`Updating project in database`)
                    return r.table('projects').get(qualifiedProjectId).replace(R.merge(projectParams, {
                      id: qualifiedProjectId,
                      owner: request.auth.credentials.username,
                      projectId: request.params.id,
                      ownerName: request.auth.credentials.name,
                      created: moment.utc().format(), // TODO
                      // TODO
                      zipFile: {
                        size: 0,
                      },
                    })).run(conn)
                      .then(() => {
                        logger.debug(`Project successfully updated in database`)
                        reply()
                      })
                  })
            })
          })
        }
      },
    },
  })
  server.route({
    method: ['DELETE',],
    path: '/api/projects/{owner}/{id}',
    config: {
      auth: 'session',
      handler: (request, reply) => {
        let owner = request.params.owner
        let qualifiedProjectId = `${owner}/${request.params.id}`
        logger.debug(`Received request to delete project '${qualifiedProjectId}'`)
        if (owner !== request.auth.credentials.username) {
          reply(Boom.unauthorized(
            `You are not allowed to delete projects for others than your own user`))
        } else {
          withDb(reply, (conn) => {
            return r.table('projects').get(qualifiedProjectId).delete().run(conn)
              .then(() => {
                logger.debug(`Project '${qualifiedProjectId}' successfully deleted`)
                reply()
              })
          })
        }
      },
    },
  })
}
