'use strict'
let logger = require('js-logger-aknudsen').get('server.api')
let Boom = require('boom')
let R = require('ramda')
let S = require('underscore.string.fp')
let moment = require('moment')
let r = require('rethinkdb')
let JSZip = require('jszip')
let request = require('request')
let gcloud = require('gcloud')
let Promise = require('bluebird')
let CryptoJs = require('crypto-js')

let stripeApi = require('./api/stripeApi')
let ajax = require('../ajax')
let {getEnvParam,} = require('./environment')
let {withDb, connectToDb, closeDbConnection,} = require('./db')
let {requestHandler,} = require('./requestHandler')
let {createProject, updateProject, getProject, deleteProject,
    updateProjectFromGitHub,} = require('./api/projectApi')
let {trimWhitespace,} = require('../stringUtils')
let {getUserWithConn,} = require('./api/apiUtils')
let {badRequest,} = require('../errors')

let getCloudStorageUrl = (bucketName, path) => {
  let encodedPath = path.replace(/#/, '%23')
  return `https://storage.googleapis.com/${bucketName}/${encodedPath}`
}

let gcs = gcloud.storage({
  projectId: getEnvParam('GCLOUD_PROJECT_ID'),
  credentials: {
    client_email: getEnvParam(`GCLOUD_CLIENT_EMAIL`),
    private_key: getEnvParam(`GCLOUD_PRIVATE_KEY`),
  },
})

let verifyDiscourseSso = (request, reply) => {
  let {payload, sig,} = request.payload
  let authedUser = request.auth.credentials
  logger.debug(`Verifying Discourse SSO parameters`)

  connectToDb()
    .then((conn) => {
      return getUserWithConn(authedUser.username, conn)
        .finally(() => {
          closeDbConnection(conn)
        })
    })
    .then((user) => {
      let secret = getEnvParam('SSO_SECRET')
      let discourseUrl = getEnvParam('DISCOURSE_URL')
      logger.debug(`Calling Hmac with payload:`, payload)
      let gotSig = CryptoJs.HmacSHA256(payload, secret).toString(CryptoJs.enc.Hex)
      logger.debug(`Got sig ${gotSig}`)
      if (gotSig === sig) {
        let rawPayload = new Buffer(payload, 'base64').toString()
        let m = /nonce=([^&]+)/.exec(rawPayload)
        if (m == null) {
          logger.warn(`Payload in bad format:`, rawPayload)
          reply(Boom.badRequest(`Payload in bad format`))
        } else {
          let nonce = m[1]
          let rawRespPayload = `nonce=${nonce}&email=${user.email}&` +
            `external_id=${user.username}&username=${user.username}&name=${user.name}`
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
    })
    .catch((error) => {
      logger.error(`An error was caught in verifyDiscourseSso:`, error.stack)
      reply(Boom.badRequest())
    })
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
      tags.push(tag.toLowerCase())
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
      .orderBy({index: r.desc(`created`),})
      .filter((project) => {
        let pred = project('projectId').match(regex).or(project('title').match(regex))
          .or(project('owner').match(regex))
        R.forEach((tag) => {
          pred = pred.and(project('tags').contains((t) => {return t.downcase().eq(tag)}))
        }, tags)
        return pred
      })
      .run(conn)
      .then((projectsCursor) => {
        return projectsCursor.toArray()
          .then((projects) => {
            logger.debug(`Found ${projects.length} project(s)`)
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
  let isLoggedInUser = request.auth.credentials != null && username ===
    request.auth.credentials.username
  withDb(reply, (conn) => {
    logger.debug(`Getting user '${username}'`)
    return getUserWithConn(username, conn)
      .then((user) => {
        if (user != null) {
          logger.debug(`Found user '${username}'`)
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
              let restrictedAttributes = [
                'id',
                'password',
              ]
              if (!isLoggedInUser) {
                restrictedAttributes = R.concat(restrictedAttributes, [
                  'gitHubAccessToken',
                  'gitHubAccount',
                ])
              }
              let extendedUser = R.merge(R.omit(restrictedAttributes, user), {
                soundCloud: {
                  uploads: R.filter((x) => x != null, embeddables),
                },
              })
              // logger.debug(`Returning user:`, extendedUser)
              if (!isLoggedInUser) {
                logger.debug(
                  `Filtering the following properties since requesting user differs ` +
                  `from requested user:`, restrictedAttributes)
              }
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
    logger.debug(`User tried to create project plan for other user`)
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
    return getUserWithConn(username, conn)
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

let updateProjectPlan = (request, reply) => {
  logger.debug(`Received request to update project plan`)
  let {username,} = request.params
  if (username !== request.auth.credentials.username) {
    logger.debug(`User tried to update project plan for other user`)
    reply(Boom.unauthorized(
      `You are not allowed to update project plans for others than yourself`))
  }

  let appKey = getEnvParam('TRELLO_KEY')
  let {id, token, name, description, organization,} = request.payload
  logger.debug(`Updating project plan:`, {id, name, description, organization,})
  ajax.putJson(`https://api.trello.com/1/boards/${id}?key=${appKey}&token=${token}`, {
    name,
    desc: description,
    idOrganization: organization,
  })
    .then(() => {
      return ajax.getJson(`https://api.trello.com/1/boards/${id}/url?key=${appKey}&token=${token}`)
        .then((url) => {
          return withDb(reply, (conn) => {
            logger.debug(`Updating project plan in database`)
            return getUserWithConn(username, conn)
              .then((user) => {
                if (user == null) {
                  logger.warn(`Couldn't find user '${username}'`)
                  throw new Error(`Couldn't find user '${username}'`)
                } else {
                  let projectPlan = {
                    id,
                    name,
                    description,
                    organization,
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
      })
    }, (error) => {
      logger.warn(`Failed to update Trello board '${id}': '${error}'`)
      reply(Boom.badImplementation())
    })
}

let removeProjectPlan = (request, reply) => {
  let doCloseBoard = (projectPlan, token) => {
    let appKey = getEnvParam('TRELLO_KEY')
    return ajax.putJson(
        `https://api.trello.com/1/boards/${projectPlan.id}/closed?key=${appKey}&token=${token}`, {
          value: true,
        })
      .then(() => {
        logger.debug(`Closed Trello board successfully`)
      }, (error) => {
        logger.warn(`Failed to close Trello board: '${error}'`)
        throw error
      })
  }

  logger.debug(`Received request to remove project plan:`, request)
  let {username, planId,} = request.params
  let {closeBoard,} = request.query
  if (username !== request.auth.credentials.username) {
    logger.debug(`User tried to remove project plan for other user`)
    reply(Boom.unauthorized(
      `You are not allowed to remove project plans for others than yourself`))
  }

  logger.debug(`Removing project plan ${planId} from user ${username}`)
  withDb(reply, (conn) => {
    return getUserWithConn(username, conn)
      .then((user) => {
        if (user == null) {
          throw new Error(`Couldn't find user '${username}'`)
        }

        let closeBoardPromise
        if (!S.isBlank(closeBoard)) {
          logger.debug(`Closing associated Trello board as well`)
          let projectPlan = R.find((projectPlan) => {
            return projectPlan.id === planId
          }, user.projectPlans)
          closeBoardPromise = doCloseBoard(projectPlan, closeBoard)
        } else {
          closeBoardPromise = Promise.resolve()
        }
        return closeBoardPromise.then(() => {
          let projectPlans = R.filter((projectPlan) => {
            return projectPlan.id !== planId
          }, user.projectPlans)
          return r.table('users')
            .get(username)
            .update({
              projectPlans,
            })
            .run(conn)
            .then(() => {
              logger.debug(`Successfully removed project plan ${planId} for user '${username}'`)
              return R.merge(user, {
                projectPlans,
              })
            }, (error) => {
              logger.warn(`Failed to remove project plan ${planId} for user '${username}':`, error)
              throw error
            })
          })
      })
  })
}

let getOtherTrelloBoards = (request, reply) => {
  logger.debug(`Received request to get a user's non-taken Trello boards`)
  let {username,} = request.params
  if (username !== request.auth.credentials.username) {
    logger.debug(`User tried to get Trello boards for other user`)
    reply(Boom.unauthorized(
      `You are not allowed to get Trello boards for others than yourself`))
  }

  let appKey = getEnvParam('TRELLO_KEY')
  let {token,} = request.query
  logger.debug(`Getting all Trello boards for user '${username}'`)
  ajax.getJson(`https://api.trello.com/1/members/me/boards?filter=open&fields=name,id&` +
    `key=${appKey}&token=${token}`)
    .then((boards) => {
      logger.debug(`Got all of users' boards:`, boards)

      return withDb(reply, (conn) => {
        return r.table('users')
          .get(username)
          .run(conn)
          .then((user) => {
            if (user == null) {
              throw new Error(`Couldn't find user '${username}'`)
            }

            let otherBoards = R.filter((board) => {
              return !R.any((projectPlan) => {
                return projectPlan.id === board.id
              }, user.projectPlans)
            }, boards)
            logger.debug(`Non-added boards:`, otherBoards)
            return otherBoards
          })
      })
    }, (error) => {
      logger.warn(`Failed to get Trello boards: '${error}'`)
      reply(Boom.badImplementation())
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
    handler: requestHandler(getProject),
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
    method: ['PUT',],
    path: 'users/{username}/projectPlans/{planId}',
    handler: updateProjectPlan,
  })
  routeApiMethod({
    method: ['DELETE',],
    path: 'users/{username}/projectPlans/{planId}',
    handler: removeProjectPlan,
  })
  routeApiMethod({
    method: ['GET',],
    path: 'users/{username}/otherTrelloBoards',
    handler: getOtherTrelloBoards,
  })
  routeApiMethod({
    method: ['GET',],
    path: 'gcloudStorageSettings',
    config: {
      auth: 'session',
      handler: (request, reply) => {
        let {path,} = request.query
        let isBackup = request.query.isBackup === 'true'
        logger.debug(
          `Getting Google Cloud Storage signed URL for path '${path}', is backup: ${isBackup}...`)
        let nominalBucketName = getEnvParam('GCLOUD_BUCKET')
        let bucketName = !isBackup ? nominalBucketName : `backup.${nominalBucketName}`
        let bucket = gcs.bucket(bucketName)
        let pathPrefix = `u/${request.auth.credentials.username}/`
        let filePath = `${pathPrefix}${path}`
        logger.debug(`File path: ${filePath}`)
        let cloudFile = bucket.file(filePath)
        cloudFile.getSignedUrl({
          action: 'write',
          expires: moment.utc().add(1, 'days').format(),
          contentType: 'ignore',
          extensionHeaders: {'x-goog-acl': 'public-read',},
        }, (error, signedUrl) => {
          if (error != null) {
            logger.debug(`Failed to obtain signed URL for file`)
            reply(Boom.badRequest())
          } else {
            logger.debug(`Got signed URL for file: ${signedUrl}`)
            reply({
              signedUrl,
              url: getCloudStorageUrl(bucketName, filePath),
            })
          }
        })
      },
    },
  })
  routeApiMethod({
    method: ['POST',],
    path: 'logError',
    handler: (request, reply) => {
      let error = request.payload.error || {}
      logger.error(`An error was logged on a client: ${error.message}:`, error.stack)
      reply()
    },
  })
  routeApiMethod({
    method: ['POST',],
    path: 'projects/{owner}',
    config: {
      auth: 'session',
      handler: requestHandler(createProject),
    },
  })
  routeApiMethod({
    method: ['PUT',],
    path: 'projects/{owner}/{id}',
    config: {
      auth: 'session',
      handler: requestHandler(updateProject),
    },
  })
  routeApiMethod({
    method: ['POST',],
    path: 'webhooks/github/{gitHubOwner}/{gitHubProject}',
    config: {
      handler: requestHandler((request, reply) => {
        let req = request.raw.req
        let event = req.headers['x-github-event']
        if (event === 'push') {
          logger.debug(`Handling GitHub push notification`, request.payload)
          let {gitHubOwner, gitHubProject,} = request.params
          logger.debug(`Repository is ${gitHubOwner}/${gitHubProject}`)
          updateProjectFromGitHub(gitHubOwner, gitHubProject, reply)
        } else {
          logger.debug(`Unrecognized event from GitHub: '${event}'`)
          reply()
        }
      }),
    },
  })
  routeApiMethod({
    method: ['DELETE',],
    path: 'projects/{owner}/{id}',
    config: {
      auth: 'session',
      handler: requestHandler(deleteProject),
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
  routeApiMethod({
    method: ['POST',],
    path: 'stripe/checkout',
    config: {
      handler: stripeApi.stripeCheckout,
    },
  })
  routeApiMethod({
    method: ['GET',],
    path: 'isProjectIdAvailable',
    config: {
      auth: 'session',
      handler: requestHandler((request, reply) => {
        let {projectId,} = request.query
        if (projectId == null) {
          throw badRequest(`projectId parameter must be supplied`)
        }

        let authedUser = request.auth.credentials
        let qualifiedProjectId = `${authedUser.username}/${projectId}`
        logger.debug(`Handling request as to whether ${qualifiedProjectId} is available`)
        withDb(reply, (conn) => {
          return r.table('projects')
            .get(qualifiedProjectId)
            .run(conn)
            .then((project) => {
              return project == null
            })
        })
      }),
    },
  })
}
