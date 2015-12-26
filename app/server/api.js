'use strict'
let logger = require('js-logger-aknudsen').get('server.api')
let AwsS3Form = require('aws-s3-form')
let Boom = require('boom')
let R = require('ramda')
let S = require('underscore.string.fp')
let moment = require('moment')
let r = require('rethinkdb')
let Aws = require('aws-sdk')
let JSZip = require('jszip')
let request = require('request')
let CryptoJs = require('crypto-js')

let licenses = require('../licenses')
let auth = require('./auth')
let {trimWhitespace,} = require('../stringUtils')
let {withDb,} = require('./db')
let {getEnvParam,} = require('./environment')
let ajax = require('../ajax')

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

let verifyLicense = (projectParams) => {
  if (licenses[projectParams.licenseId] == null) {
    throw new Error(`Invalid license '${projectParams.licenseId}'`)
  }
}

let getS3Client = () => {
  return new Aws.S3({
    accessKeyId: getEnvParam('AWS_ACCESS_KEY'),
    secretAccessKey: getEnvParam('AWS_SECRET_ACCESS_KEY'),
    region: getEnvParam('S3_REGION'),
    params: {
      Bucket: getEnvParam('S3_BUCKET'),
    },
  })
}

let downloadResource = (url, options) => {
  logger.debug(`Downloading resource '${url}'...`)
  let {encoding,} = options || {}
  return new Promise((resolve, reject) => {
    let performRequest = (numTries) => {
      logger.debug(`Attempt #${numTries}`)
      request.get(url, {
        encoding: encoding,
      }, (error, response, body) => {
        if (error == null && response.statusCode === 200) {
          logger.debug(`Downloaded '${url}' successfully`)
          resolve(body)
        } else {
          if (numTries > 3) {
            logger.warn(`Failed to download '${url}'`)
            reject(error)
          } else {
            performRequest(numTries + 1)
          }
        }
      })
    }

    performRequest(1)
  })
}

let createZip = (owner, projectId, projectParams) => {
  if (R.isEmpty(projectParams.files)) {
    logger.debug(`There are no files, not generating zip`)
    return Promise.resolve(null)
  }

  logger.debug('Generating zip...')
  let s3Client = getS3Client()
  // TODO: Async
  let zip = new JSZip()
  let downloadPromises = R.map((file) => {
    return downloadResource(file.url)
      .then((content) => {
        logger.debug(`Adding file '${file.fullPath}' to zip`)
        zip.file(file.fullPath, content)
      })
  }, projectParams.files)
  logger.debug(`Waiting on download promises:`, downloadPromises)
  return Promise.all(downloadPromises)
    .then(() => {
      logger.debug(`All files added to zip`)
      logger.debug(`Generating zip...`)
      let output = zip.generate({
        type: 'nodebuffer',
        compression: 'DEFLATE',
      })

      logger.debug(`Uploading zip file to S3...`)
      let filePath = `u/${owner}/${projectId}/${projectId}.zip`
      return new Promise((resolve, reject) => {
        s3Client.putObject({
          Key: filePath,
          ACL: 'public-read',
          Body: output,
        }, (error, data) => {
          if (error == null) {
            //  TODO: Try to get URL from S3
            let region = getEnvParam('S3_REGION')
            let bucket = getEnvParam('S3_BUCKET')
            let zipUrl = `https://s3.${region}.amazonaws.com/${bucket}/${filePath}`
            logger.debug(`Uploaded zip file successfully to '${zipUrl}'`)
            resolve({
              url: zipUrl,
              size: output.length,
            })
          } else {
            logger.warn(`Failed to upload zip file: '${error}':`, error.stack)
            reject(error)
          }
        })
      })
    }, (error) => {
      logger.warn(`Failed to download files: '${error}'`)
      throw new Error(error)
    })
}

let createProject = (request, reply) => {
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
    verifyLicense(projectParams)

    createZip(owner, projectParams.id, projectParams)
      .then((zipFile) => {
        let project = new Project(R.merge(projectParams, {
          owner: request.auth.credentials.username,
          ownerName: request.auth.credentials.name,
          created: moment.utc().format(),
          zipFile,
        }))
        withDb(reply, (conn) => {
          logger.debug(`Creating project '${qualifiedProjectId}':`, project)
          return r.table('projects')
            .get(qualifiedProjectId)
            .replace(R.merge(project, {
              id: qualifiedProjectId,
            }))
            .run(conn)
        })
      }, (error) => {
        logger.warn(`Failed to generate zip: ${error}:`, error.stack)
        throw new Error(error)
      })
  }
}

let updateProject = (request, reply) => {
  let owner = request.params.owner
  if (owner !== request.auth.credentials.username) {
    reply(Boom.unauthorized(
      `You are not allowed to update projects for others than your own user`))
  } else {
    let projectParams = request.payload
    verifyLicense(projectParams)
    let projectId = request.params.id
    let qualifiedProjectId = `${owner}/${projectId}`
    logger.debug(`Received request to update project '${qualifiedProjectId}':`, projectParams)
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
          logger.warn(`Failed to remove ${fileType}(s) ${filePathsStr}: '${error}':`,
            error.stack)
        })
    }

    createZip(owner, projectId, projectParams)
      .then((zipFile) => {
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
                  return r.table('projects').get(qualifiedProjectId)
                    .replace(R.merge(projectParams, {
                      id: qualifiedProjectId,
                      owner: request.auth.credentials.username,
                      projectId: request.params.id,
                      ownerName: request.auth.credentials.name,
                      created: moment.utc().format(), // TODO
                      zipFile,
                    })).run(conn)
                      .then(() => {
                        logger.debug(`Project successfully updated in database`)
                      })
                })
          })
        })
    })
  }
}

let verifyDiscourseSso = (request, reply) => {
  let {payload, sig,} = request.payload
  let user = request.auth.credentials
  logger.debug(`Verifying Discourse SSO parameters`)
  let secret = getEnvParam('SSO_SECRET')
  let discourseUrl = getEnvParam('DISCOURSE_URL')
  logger.debug(`Calling Hmac:`, {payload, secret,})
  let gotSig = CryptoJs.HmacSHA256(payload, secret).toString(CryptoJs.enc.Hex)
  logger.debug(`Got sig ${gotSig}`)
  if (gotSig === sig) {
    let rawPayload = new Buffer(payload, 'base64').toString()
    let m = /nonce=(.+)/.exec(rawPayload)
    if (m == null) {
      logger.warn(`Payload in bad format:`, rawPayload)
      reply(boom.badRequest(`Payload in bad format`))
    } else {
      let nonce = m[1]
      let rawRespPayload = `nonce=${nonce}&email=${user.email}&
external_id=${user.username}&username=${user.username}&name=${user.name}`
      logger.debug(`Responding with payload '${rawRespPayload}'`)
      let respPayload = new Buffer(rawRespPayload).toString('base64')
      let respSig = CryptoJs.HmacSHA256(respPayload, secret).toString(CryptoJs.enc.Hex)
      reply([respPayload, respSig, discourseUrl,])
    }
  } else {
    let msg = `Payload signature isn't as expected`
    logger.warn(msg)
    reply(Boom.badRequest(msg))
  }
}

let search = (request, reply) => {
  logger.debug(`Searching for '${request.query.query}'`)
  withDb(reply, (conn) => {
    let reTag = /\[[^\]]*\]/g
    let queryWithoutTags = ''
    let tags = []
    let offset = 0
    let query = request.query.query
    while (true) {
      let m = reTag.exec(query)
      if (m == null) {
        break
      }

      let tag = trimWhitespace(m[0].slice(1, -1))
      logger.debug(`Found tag '${tag}'`)
      tags.push(tag)
      queryWithoutTags += ' ' + query.slice(offset, m.index)
      offset = reTag.lastIndex
    }

    queryWithoutTags += ' ' + query.slice(offset)
    queryWithoutTags = trimWhitespace(queryWithoutTags.replace(/\s+/g, ' '))

    if (!S.isBlank(queryWithoutTags)) {
      logger.debug(`Tag-less query: '${queryWithoutTags}'`)
    } else {
      logger.debug(`Tag-less query is empty`)
    }
    if (!R.isEmpty(tags)) {
      logger.debug(`Tags:`, tags)
    } else {
      logger.debug(`No tags`)
    }
    let regex = `(?i)${queryWithoutTags}`
    return r.table('projects')
      .filter((project) => {
        let pred = project('projectId').match(regex).or(project('title').match(regex))
          .or(project('owner').match(regex))
        R.forEach((tag) => {
          pred = pred.and(project('tags').contains(tag))
        }, tags)
        return pred
      })
      .run(conn)
      .then((projectsCursor) => {
        return projectsCursor.toArray()
          .then((projects) => {
            logger.debug(`Found ${projects.length} project(s):`, projects)
            return projects
          }, (error) => {
            logger.warn(`Failed to iterate projects: '${error}'`, error.stack)
            throw new Error(error)
          })
      })
  })
}

let getUser = (request, reply) => {
  let {username,} = request.params
  withDb(reply, (conn) => {
    logger.debug(`Getting user '${username}'`)
    return r.table('users')
      .get(username)
      .merge((user) => {
        return {
          'projects': r.table('projects').getAll(username, {index: 'owner',})
            .coerceTo('array'),
        }
      })
      .run(conn)
      .then((user) => {
        if (user != null) {
          logger.debug(`Found user '${username}':`, user)
          let soundCloud = user.soundCloud || {}
          let scUploads = soundCloud.uploads || []
          if (!R.isEmpty(scUploads)) {
            logger.debug(`Getting SoundCloud embeddables for user...`)
          }
          let scPromises = R.map((upload) => {
            let uploadUrl = `http://soundcloud.com/${upload.path}`
            let url = `http://soundcloud.com/oembed?format=json&url=${uploadUrl}`
            return downloadResource(url, {encoding: 'utf-8',})
              .then((content) => {
                return JSON.parse(content)
              }, (error) => {
                logger.warn(
                  `Ignoring upload at '${uploadUrl}' since we couldn't get its embed data`)
                return null
              })
          }, scUploads)
          return Promise.all(scPromises)
            .then((embeddables) => {
              let extendedUser = R.merge(user, {
                soundCloud: {
                  uploads: R.filter((x) => x != null, embeddables),
                },
              })
              logger.debug(`Returning user:`, extendedUser)
              return extendedUser
            }, (error) => {
              logger.error(`An error occurred:`, error)
              throw new Error(error)
            })
        } else {
          logger.debug(`Could not find user '${username}'`)
          return Boom.notFound()
        }
      })
  })
}

let addProjectPlan = (request, reply) => {
  logger.debug(`Received request to add project plan`)
  let {username,} = request.params
  if (username !== request.auth.credentials.username) {
    logger.debug(`User tried to create project for other user`)
    reply(Boom.unauthorized(
      `You are not allowed to create project plans for others than yourself`))
  }

  let appKey = getEnvParam('TRELLO_KEY')
  let {id, token, name, description, organization,} = request.payload
  if (id == null) {
    let params = R.pickBy((value) => value != null, {
      name: name,
      desc: description,
      idOrganization: organization,
      prefs_permissionLevel: 'public',
    })
    logger.debug(`Creating Trello board:`, params)
    ajax.postJson(`https://api.trello.com/1/boards?key=${appKey}&token=${token}`, params)
      .then((R.partial(addTrelloBoard, [username, request, reply,])), (error) => {
        logger.warn(`Failed to create Trello board: '${error}'`)
        reply(Boom.badImplementation())
      })
  } else {
    logger.debug(`Adding existing Trello board:`, {id, name, description, organization,})
    ajax.getJson(`https://api.trello.com/1/boards/${id}?key=${appKey}&token=${token}`)
      .then(R.partial(addTrelloBoard, [username, request, reply,]), (error) => {
        logger.warn(`Failed to get Trello board: '${error}'`)
        reply(Boom.badImplementation())
      })
  }
}

let addTrelloBoard = (username, request, reply, data) => {
  let {id, name, desc, idOrganization, url,} = data
  withDb(reply, (conn) => {
    logger.debug(`Adding project plan '${id}' for user '${username}':`,
      {name, desc, idOrganization, url,})
    return r.table('users')
      .get(username)
      .run(conn)
      .then((user) => {
        if (user == null) {
          logger.warn(`Couldn't find user '${username}'`)
          throw new Error(`Couldn't find user '${username}'`)
        } else {
          let projectPlan = {
            id,
            name,
            description: desc,
            organization: idOrganization,
            url,
          }
          let projectPlans = R.concat(R.filter((projectPlan) => {
            return projectPlan.id !== id
          }, user.projectPlans || []), projectPlan)
          return r.table('users')
            .get(username)
            .update({
              projectPlans,
            })
            .run(conn)
            .then(() => {
              logger.debug(`User successfully updated in database`)
              return R.merge(user, {projectPlans,})
            }, (error) => {
              logger.warn(`Failed to update project in database:`, error)
              throw new Error(`Failed to update project in database: '${error}'`)
            })
        }
      })
  })
}

let getProject = (request, reply) => {
  let {owner, projectId,} = request.params
  let qualifiedProjectId = `${owner}/${projectId}`
  logger.debug(`Getting project '${qualifiedProjectId}'`)
  withDb(reply, (conn) => {
    return r.table('projects').get(qualifiedProjectId).run(conn)
      .then((project) => {
        if (project != null) {
          logger.debug(`Found project '${qualifiedProjectId}':`, project)
          return project
        } else {
          logger.debug(`Could not find project '${qualifiedProjectId}'`)
          return Boom.notFound()
        }
      })
  })
}

module.exports.register = (server) => {
  let routeApiMethod = (options) => {
    let path = `/api/${options.path}`
    server.route(R.merge(options, {
      path,
    }))
  }

  routeApiMethod({
    method: ['GET',],
    path: 'search',
    handler: search,
  })
  routeApiMethod({
    method: ['GET',],
    path: 'projects/{owner}/{projectId}',
    handler: getProject,
  })
  routeApiMethod({
    method: ['GET',],
    path: 'users/{username}',
    handler: getUser,
  })
  routeApiMethod({
    method: ['POST',],
    path: 'users/{username}/projectPlans',
    handler: addProjectPlan,
  })
  routeApiMethod({
    method: ['GET',],
    path: 's3Settings/{directive}',
    config: {
      auth: 'session',
      handler: (request, reply) => {
        let {directive,} = request.params
        let {key, isBackup,} = request.query
        logger.debug(`Getting S3 form data for directive '${directive}'`)

        let bucket = !isBackup ? getEnvParam('S3_BUCKET') : `backup.${getEnvParam('S3_BUCKET')}`
        let keyPrefix = `u/${request.auth.credentials.username}/`
        let region = getEnvParam('S3_REGION')
        let s3Form = new AwsS3Form({
          secure: true,
          accessKeyId: getEnvParam('AWS_ACCESS_KEY'),
          secretAccessKey: getEnvParam('AWS_SECRET_ACCESS_KEY'),
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
          region,
          url,
          fields: formData.fields,
        })
      },
    },
  })
  routeApiMethod({
    method: ['POST',],
    path: 'logError',
    handler: (request, reply) => {
      let error = request.payload.error
      logger.warn(`An error was logged on a client: ${error}:`, error.stack)
      reply()
    },
  })
  routeApiMethod({
    method: ['POST',],
    path: 'projects/{owner}',
    config: {
      auth: 'session',
      handler: createProject,
    },
  })
  routeApiMethod({
    method: ['PUT',],
    path: 'projects/{owner}/{id}',
    config: {
      auth: 'session',
      handler: updateProject,
    },
  })
  routeApiMethod({
    method: ['DELETE',],
    path: 'projects/{owner}/{id}',
    config: {
      auth: 'session',
      handler: (request, reply) => {
        let removeFolder = () => {
          let dirPath = `u/${owner}/${request.params.id}`
          logger.debug(`Removing folder '${dirPath}'...`)
          logger.debug(`Listing folder contents...`)
          return new Promise((resolve, reject) => {
            s3Client.listObjects({Prefix: `${dirPath}/`,}, (error, data) => {
              if (error == null) {
                resolve(data.Contents)
              } else {
                logger.warn(`Failed to list folder '${dirPath}': '${error}':`, error.stack)
                reject(error)
              }
            })
          })
            .then((objects) => {
              logger.debug(`Successfully listed folder contents:`, objects)
              if (R.isEmpty(objects)) {
                logger.debug(`Nothing to remove`)
                return Promise.resolve()
              }

              let toDelete = R.map((o) => {
                return {Key: o.Key,}
              }, objects)
              logger.debug(`Deleting folder contents...`)
              return new Promise((resolve, reject) => {
                s3Client.deleteObjects({
                  Delete: {
                    Objects: toDelete,
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
                  logger.debug(`Successfully removed ${objects.length} object(s)`)
                  // API will list max 1000 objects
                  if (objects.length === 1000) {
                    logger.debug('We hit max number of listed objects, deleting recursively')
                    return removeFolder()
                  }
                }, (error) => {
                  logger.warn(`Failed to remove ${objects.length} object(s): '${error}':`,
                    error.stack)
                })
              })
        }

        let s3Client = getS3Client()
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
                return removeFolder()
                  .then(() => {
                    logger.debug(`Project '${qualifiedProjectId}' successfully deleted`)
                  })
              })
          })
        }
      },
    },
  })
  routeApiMethod({
    method: ['POST',],
    path: 'verifyDiscourseSso',
    config: {
      auth: 'session',
      handler: verifyDiscourseSso,
    },
  })
}
