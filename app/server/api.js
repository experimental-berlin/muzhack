'use strict'
let logger = require('js-logger-aknudsen').get('server.api')
let Boom = require('boom')
let R = require('ramda')
let S = require('underscore.string.fp')
let moment = require('moment')
let r = require('rethinkdb')
let JSZip = require('jszip')
let request = require('request')
let CryptoJs = require('crypto-js')
let licenses = require('../licenses')
let {trimWhitespace,} = require('../stringUtils')
let {withDb, connectToDb, closeDbConnection,} = require('./db')
let {getEnvParam,} = require('./environment')
let ajax = require('../ajax')
let stripeApi = require('./api/stripeApi')
let Yaml = require('yamljs')
let TypedError = require('error/typed')
let gcloud = require('gcloud')
let Promise = require('bluebird')

let gcs = gcloud.storage({
  projectId: getEnvParam('GCLOUD_PROJECT_ID'),
  credentials: {
    client_email: getEnvParam(`GCLOUD_CLIENT_EMAIL`),
    private_key: getEnvParam(`GCLOUD_PRIVATE_KEY`),
  },
})

class Project {
  constructor({projectId, tags, owner, ownerName, title, created, pictures, licenseId,
      description, instructions, files, zipFile, gitHubRepository,}) {
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
    this.gitHubRepository = gitHubRepository || null
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

let notFoundError = TypedError({
  type: 'notFound',
  message: 'Resource not found',
})

let downloadResource = (url, options) => {
  logger.debug(`Downloading resource '${url}'...`)
  let {encoding,} = options || {}
  return new Promise((resolve, reject) => {
    let performRequest = (numTries) => {
      logger.debug(`Attempt #${numTries} for ${url}`)
      request.get(url, {
        encoding: encoding,
        headers: {
          'User-Agent': 'request',
        },
      }, (error, response, body) => {
        if (error == null && response.statusCode === 200) {
          logger.debug(`Downloaded '${url}' successfully`)
          resolve(body)
        } else if (response.statusCode === 404) {
          reject(notFoundError())
        } else {
          if (numTries > 3) {
            logger.warn(`Failed to download '${url}':`, error)
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

let createZip = (owner, projectParams) => {
  let projectId = projectParams.projectId

  if (R.isEmpty(projectParams.files)) {
    logger.debug(`There are no files, not generating zip`)
    return Promise.resolve(null)
  }

  logger.debug('Generating zip...')
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
      logger.debug(`Uploading zip file to Cloud Storage...`)
      let bucketName = getEnvParam(`GCLOUD_BUCKET`)
      let bucket = gcs.bucket(bucketName)
      let cloudFilePath = `u/${owner}/${projectId}/${projectId}.zip`
      let cloudFile = bucket.file(cloudFilePath)
      return new Promise((resolve, reject) => {
        return zip.generateNodeStream({
          type: 'nodebuffer',
          compression: 'DEFLATE',
          streamFiles: true,
        })
          .pipe(cloudFile.createWriteStream())
          .on('finish', () => {
            logger.debug(`Uploading zip archive succeeded`)
            cloudFile.makePublic((error) => {
              if (error != null) {
                logger.warn(`Making zip archive public failed`)
                reject(error)
              } else {
                cloudFile.getMetadata((error, metadata) => {
                  if (error != null) {
                    logger.warn(`Failed to get zip metadata`, error)
                    reject(error)
                  } else {
                    logger.debug(`Got zip metadata`, metadata)
                    resolve({
                      url: `https://storage.googleapis.com/${bucketName}/${cloudFilePath}`,
                      size: metadata.size,
                    })
                  }
                })
              }
            })
          })
          .on('error', (error) => {
            logger.warn(`Failed to upload zip archive: ${error}`)
            reject()
          })
      })
    }, (error) => {
      logger.warn(`Failed to download files: '${error}'`)
      throw new Error(error)
    })
}

let copyFilesToCloudStorage = (files, dirPath, owner, projectId) => {
  let bucketName = getEnvParam(`GCLOUD_BUCKET`)
  let bucket = gcs.bucket(bucketName)
  let copyPromises = R.map((file) => {
    return new Promise((resolve, reject) => {
      let cloudFilePath = `u/${owner}/${projectId}/${dirPath}/${file.fullPath}`
      logger.debug(`Copying file to Cloud Storage: ${file.url} -> ${cloudFilePath}...`)

      let performRequest = (numTries) => {
        logger.debug(`Attempt #${numTries} for ${file.url}`)
        let cloudFile = bucket.file(cloudFilePath)
        request.get(file.url, {
          headers: {
            'User-Agent': 'request',
          },
        })
          .pipe(cloudFile.createWriteStream())
          .on('error', (err) => {
            if (response.statusCode === 404) {
              reject(notFoundError())
            } else if (numTries > 3) {
              logger.warn(`Failed to download '${url}':`, error)
              reject(error)
            } else {
              // TODO: Wait
              performRequest(numTries + 1)
            }
          })
          .on('finish', () => {
            logger.debug(`Successfully copied ${file.url} to Cloud Storage`)
            cloudFile.makePublic((err) => {
              if (err != null) {
                reject(err)
              } else {
                resolve(R.merge(file, {
                  url: `https://storage.googleapis.com/${bucketName}/${cloudFilePath}`,
                }))
              }
            })
          })
      }

      performRequest(1)
    })
  }, files)

  return Promise.all(copyPromises)
}

let downloadFileFromGitHub = (gitHubOwner, gitHubProject, path) => {
  let [clientId, clientSecret,] = getGitHubCredentials()
  return downloadResource(
      `https://api.github.com/repos/${gitHubOwner}/${gitHubProject}/contents/muzhack/${path}?` +
      `client_id=${clientId}&client_secret=${clientSecret}`)
    .then((fileJson) => {
      let file = JSON.parse(fileJson)
      return {
        content: new Buffer(file.content, 'base64').toString(),
      }
    })
}

let getProjectParamsForGitHubRepo = (owner, projectId, gitHubOwner, gitHubProject) => {
  let qualifiedRepoId = `${gitHubOwner}/${gitHubProject}`
  let downloadFile = R.partial(downloadFileFromGitHub, [gitHubOwner, gitHubProject,])
  let [gitHubClientId, gitHubClientSecret,] = getGitHubCredentials()

  let getDirectory = (path, recurse) => {
    logger.debug(`Getting directory '${path}', recursively: ${recurse}...`)
    return downloadResource(
        `https://api.github.com/repos/${gitHubOwner}/${gitHubProject}/contents/muzhack/${path}?` +
        `client_id=${gitHubClientId}&client_secret=${gitHubClientSecret}`)
      .then((dirJson) => {
        let dir = JSON.parse(dirJson)
        if (R.isArrayLike(dir)) {
          let filePromises = R.map((file) => {
            let rootDir = S.wordsDelim('/', path)[0]
            return Promise.resolve({
              name: file.name,
              url: file.download_url,
              fullPath: file.path.replace(new RegExp(`^muzhack/${rootDir}/`), ''),
              size: file.size,
            })
          }, R.filter((entry) => {return entry.type === 'file'}, dir))
          let nestedFilePromises
          if (recurse) {
            let subDirs = R.filter((entry) => {return entry.type === 'dir'}, dir)
            nestedFilePromises = R.map(
              (subDir) => {return getDirectory(`${path}/${subDir.name}`, true)}, subDirs)
          } else {
            nestedFilePromises = []
          }
          return Promise.all(R.concat(filePromises, nestedFilePromises))
            .then(R.flatten)
        } else {
          return []
        }
      }, (error) => {
        if (error.type === 'notFound') {
          logger.debug(`Couldn't find directory '${path}'`)
          return []
        } else {
          throw error
        }
      })
  }

  logger.debug(`Getting project parameters from GitHub repository '${qualifiedRepoId}'`)
  let downloadPromises = [
    downloadFile(`metadata.yaml`),
    downloadFile(`description.md`),
    downloadFile(`instructions.md`),
  ]
  let getDirPromises = [getDirectory('pictures'), getDirectory('files', true),]
  return Promise.all(R.concat(downloadPromises, getDirPromises))
    .then(([metadataFile, descriptionFile, instructionsFile, gitHubPictures, gitHubFiles,]) => {
      let metadata = Yaml.parse(metadataFile.content)
      logger.debug(`Downloaded all MuzHack data from GitHub repository '${qualifiedRepoId}'`)
      logger.debug(`Metadata:`, metadata)
      if (projectId == null) {
        projectId = metadata.projectId
      }
      let copyPicturesPromise = copyFilesToCloudStorage(
        gitHubPictures, 'pictures', owner, projectId)
      let copyFilesPromise = copyFilesToCloudStorage(
        gitHubFiles, 'files', owner, projectId)
      return Promise.all([copyPicturesPromise, copyFilesPromise,])
        .then(([pictures, files,]) => {
          return R.merge({gitHubOwner, gitHubProject,}, {
            id: projectId,
            projectId,
            title: metadata.title,
            licenseId: metadata.licenseId,
            tags: metadata.tags,
            description: descriptionFile.content,
            instructions: instructionsFile.content,
            gitHubRepository: qualifiedRepoId,
            files,
            pictures,
          })
        })
    }, (error) => {
      logger.error(
        `Failed to get MuzHack project parameters from GitHub repository '${qualifiedRepoId}':`,
        error.stack)
      throw new Error(
        `Failed to get MuzHack project parameters from GitHub repository '${qualifiedRepoId}'`
      )
    })
}

let createProjectFromParameters = (projectParams, owner, ownerName) => {
  logger.debug(`Got project parameters`, projectParams)
  projectParams.projectId = projectParams.id
  let qualifiedProjectId = `${owner}/${projectParams.projectId}`
  verifyLicense(projectParams)

  return createZip(owner, projectParams)
    .then((zipFile) => {
      let project = new Project(R.merge(projectParams, {
        owner,
        ownerName,
        created: moment.utc().format(),
        zipFile,
      }))
      return connectToDb()
        .then((conn) => {
          logger.debug(`Creating project '${qualifiedProjectId}':`, project)
          let extendedProject = R.merge(project, {
            id: qualifiedProjectId,
          })
          return r.table('projects')
            .get(qualifiedProjectId)
            .replace(extendedProject)
            .run(conn)
            .then(() => {
              return extendedProject
            })
            .finally(() => {
              closeDbConnection(conn)
            })
        })
    }, (error) => {
      logger.warn(`Failed to generate zip: ${error.message}:`, error.stack)
      throw error
    })
}

let installGitHubWebhook = (owner, gitHubOwner, gitHubProject) => {
  return connectToDb()
    .then((conn) => {
      return getUserWithConn(owner, conn)
        .finally(() => {
          closeDbConnection(conn)
        })
    })
    .then((user) => {
      let callbackUrl = `${getEnvParam('APP_URI')}/api/webhooks/github/${gitHubOwner}/` +
        `${gitHubProject}`
      return ajax.postJson(
        `https://api.github.com/repos/${gitHubOwner}/${gitHubProject}/hooks`,
        {
          name: `web`,
          active: true,
          config: {
            url: callbackUrl,
            content_type: 'json',
            // TODO: Turn back on once muzhack.com certificates is accepted by GitHub
            insecure_ssl: '1',
          },
        }, {
          headers: {
            Authorization: `token ${user.gitHubAccessToken}`,
          },
        })
        .then((createResults) => {
          logger.debug(
            `Successfully installed GitHub webhook for ${gitHubOwner}/${gitHubProject}:`, createResults)
          if (createResults.id == null) {
            throw new Error(`Couldn't get webhook ID`)
          }
          return createResults.id
        }, (error) => {
          logger.warn(
            `Failed to install GitHub webhook for ${gitHubOwner}/${gitHubProject}:`, error)
          // TODO: Detach GitHub account in case token is invalid
          throw error
        })
    })
}

let createProjectFromGitHub = (owner, ownerName, projectParams, reply) => {
  logger.debug(
    `Creating project slaved to GitHub repository '${projectParams.gitHubOwner}/` +
      `${projectParams.gitHubProject}:`)
  let {gitHubOwner, gitHubProject,} = projectParams
  getProjectParamsForGitHubRepo(owner, null, gitHubOwner, gitHubProject)
    .then((newProjectParams) => {
      return createProjectFromParameters(newProjectParams, owner, ownerName)
    }, (error) => {
      logger.warn(error.message)
      reply(Boom.badRequest(error.message))
    })
    .then((project) => {
      let appEnvironment = getEnvParam(`APP_ENVIRONMENT`, null)
      let returnValue = {
        qualifiedProjectId: `${project.id}`,
      }
      if (appEnvironment === 'production' || appEnvironment === 'staging') {
        logger.debug(`Installing webhook at GitHub`)
        return installGitHubWebhook(owner, gitHubOwner, gitHubProject)
          .then((webhookId) => {
            logger.debug(`Setting GitHub webhook ID on project ${project.id}: ${webhookId}`)
            return connectToDb()
              .then((conn) => {
                return r.table('projects')
                  .get(project.id)
                  .update({
                    gitHubWebhookId: webhookId,
                  })
                  .run(conn)
                  .then(() => {
                    logger.debug(`Successfully set webhook ID on project, returning:`, returnValue)
                    reply(returnValue)
                  })
                  .finally(() => {
                    closeDbConnection(conn)
                  })
              })
          })
      } else {
        logger.debug(`Not installing GitHub webhook, since we aren't in a supported environment`)
        logger.debug(`Replying with:`, returnValue)
        reply(returnValue)
      }
    })
    .catch((error) => {
      logger.error(`An error occurred:`, error.stack)
      reply(Boom.badImplementation())
    })
}

let createProject = (request, reply) => {
  let projectParams = request.payload
  logger.debug(`Received request to create project:`, projectParams)
  let owner = request.params.owner
  let ownerName = request.auth.credentials.name
  if (owner !== request.auth.credentials.username) {
    logger.debug(`User tried to create project for other user`)
    reply(Boom.unauthorized(
      `You are not allowed to create projects for others than your own user`))
  } else {
    let isGitHubRepo = !S.isBlank(projectParams.gitHubOwner) &&
      !S.isBlank(projectParams.gitHubProject)
    if (isGitHubRepo) {
      createProjectFromGitHub(owner, ownerName, projectParams, reply)
    } else {
      createProjectFromParameters(projectParams, owner, ownerName)
        .then(() => {
          reply()
        })
    }
  }
}

let realUpdateProject = (owner, ownerName, projectId, projectParams, reply) => {
  verifyLicense(projectParams)

  let qualifiedProjectId = `${owner}/${projectId}`

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
    let bucketName = getEnvParam('GCLOUD_BUCKET')
    let bucket = gcs.bucket(bucketName)
    return Promise.map(filePaths, (filePath) => {
      return new Promise((resolve, reject) => {
        bucket.file(filePath).delete((error) => {
          if (error == null || error.message.toLowerCase() === 'not found') {
            resolve()
          } else {
            reject(error)
          }
        })
      })
    }, {concurrency: 10,})
      .then(() => {
        logger.debug(`Successfully removed ${fileType}(s) ${filePathsStr}`)
      }, (error) => {
        let msg = `Failed to remove ${fileType}(s) ${filePathsStr}: '${error}'`
        logger.warn(`${msg}:`, error.stack)
        throw new Error(msg)
      })
  }

  createZip(owner, R.merge(projectParams, {projectId,}))
    .then((zipFile) => {
      withDb(reply, (conn) => {
        return r.table('projects').get(qualifiedProjectId).run(conn)
          .then((project) => {
            if (project.gitHubRepository != null && projectParams.gitHubOwner == null) {
              throw new Error(`Trying to update GitHub imported project directly`)
            } else if (projectParams.gitHubOwner != null && project.gitHubRepository == null) {
              throw new Error(`Trying to sync standalone project with GitHub`)
            }

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
                    owner,
                    projectId,
                    ownerName,
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

let updateProject = (request, reply) => {
  let owner = request.params.owner
  if (owner !== request.auth.credentials.username) {
    reply(Boom.unauthorized(
      `You are not allowed to update projects for others than your own user`))
  } else {
    let projectParams = request.payload
    let projectId = request.params.id
    let ownerName = request.auth.credentials.name

    logger.debug(`Received request to update project '${owner}/${projectId}':`, projectParams)
    realUpdateProject(owner, ownerName, projectId, projectParams, reply)
  }
}

let getGitHubCredentials = () => {
  return [getEnvParam('GITHUB_CLIENT_ID'), getEnvParam('GITHUB_CLIENT_SECRET'),]
}

let updateProjectFromGitHub = (repoOwner, repoName, reply) => {
  return downloadFileFromGitHub(repoOwner, repoName, 'metadata.yaml')
    .then((metadata) => {
      let {projectId,} = metadata
      return connectToDb()
        .then((conn) => {
          let qualifiedRepoName = `${repoOwner}/${repoName}`
          logger.debug(`Finding projects imported from GitHub repository ${qualifiedRepoName}`)
          return r.table('projects')
            .filter((project) => {
              return project('gitHubRepository').eq(qualifiedRepoName)
            })
            .run(conn)
            .then((cursor) => {
              return cursor.toArray()
            })
            .then((projects) => {
              logger.debug(`Syncing ${projects.length} project(s) with GitHub repositories...`)
              return Promise.mapSeries(projects, (project) => {
                logger.debug(
                  `Syncing project ${project.owner}/${project.projectId} with GitHub...`)
                return getProjectParamsForGitHubRepo(project.owner, project.projectId, repoOwner,
                    repoName)
                  .then((projectParams) => {
                    return realUpdateProject(project.owner, project.ownerName, project.projectId,
                      projectParams, reply)
                  })
              }, projects)
            })
            .finally(() => {
              closeDbConnection(conn)
            })
        })
    })
      .then(() => {
        logger.debug(`Finished syncing projects with GitHub`)
      }, (error) => {
        logger.error(`Syncing projects with GitHub failed:`, error)
        reply(Boom.badImplementation())
      })
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

let getUserWithConn = (username, conn) => {
  if (username == null) {
    throw new Error(`username is null`)
  }
  logger.debug(`Getting user '${username}'...`)
  return r.table('users')
    .get(username)
    .merge((user) => {
      return {
        'projects': r.table('projects').getAll(username, {index: 'owner',})
          .coerceTo('array'),
      }
    })
    .run(conn)
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
              logger.debug(`Returning user:`, extendedUser)
              if (!isLoggedInUser) {
                logger.debug(`Filtering out the following properties:`, restrictedAttributes)
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

let removeWebhook = (project) => {
  let appEnvironment = getEnvParam('APP_ENVIRONMENT')
  let {gitHubRepository, gitHubWebhookId,} = project
  if (appEnvironment === 'production' || appEnvironment === 'staging') {
    if (gitHubRepository != null && gitHubWebhookId != null) {
      logger.debug(`Deleting webhook for ${gitHubRepository} at GitHub`)
      return connectToDb()
        .then((conn) => {
          return getUserWithConn(owner, conn)
            .finally(() => {
              closeDbConnection(conn)
            })
        })
        .then((user) => {
          return ajax.deleteJson(
            `https://api.github.com/repos/${gitHubRepository}/hooks/${gitHubWebhookId}`,
            {
              headers: {
                Authorization: `token ${user.gitHubAccessToken}`,
              },
            })
            .then(() => {
              logger.debug(
                `Successfully deleted GitHub webhook for ${gitHubRepository}`)
            }, (error) => {
              logger.debug(
                `Failed to delete GitHub webhook for ${gitHubRepository}:`, error)
              // TODO: Detach GitHub account in case token is invalid
            })
        })
    } else {
      logger.debug(`Project isn't imported from GitHub, so not deleting webhook:`, project)
    }
  } else {
    logger.debug(`Not deleting GitHub webhook, since we aren't in a supported environment`)
  }
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
          // Workaround for bug in gcloud-node, where extensionHeaders is prepended to resource
          // in signature
          extensionHeaders: 'x-goog-acl:public-read\n',
        }, (error, signedUrl) => {
          if (error != null) {
            logger.debug(`Failed to obtain signed URL for file`)
            reply(Boom.badRequest())
          } else {
            logger.debug(`Got signed URL for file: ${signedUrl}`)
            reply({
              signedUrl,
              url: `https://storage.googleapis.com/${bucketName}/${filePath}`,
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
    method: ['POST',],
    path: 'webhooks/github/{gitHubOwner}/{gitHubProject}',
    config: {
      handler: (request, reply) => {
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
      },
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
            let bucketName = getEnvParam(`GCLOUD_BUCKET`)
            let bucket = gcs.bucket(bucketName)
            bucket.deleteFiles({
              force: true,
            }, (error) => {
              if (error == null) {
                resolve()
              } else {
                reject(error)
              }
            })
          })
        }

        let owner = request.params.owner
        let qualifiedProjectId = `${owner}/${request.params.id}`

        logger.debug(`Received request to delete project '${qualifiedProjectId}'`)
        if (owner !== request.auth.credentials.username) {
          reply(Boom.unauthorized(
            `You are not allowed to delete projects for others than your own user`))
        } else {
          withDb(reply, (conn) => {
            return r.table('projects').get(qualifiedProjectId).run(conn)
              .then((project) => {
                if (project != null) {
                  return r.table('projects').get(qualifiedProjectId).delete().run(conn)
                    .then(removeFolder)
                    .then(() => {
                      removeWebhook(project)
                    })
                    .then(() => {
                      logger.debug(`Project '${qualifiedProjectId}' successfully deleted`)
                    })
                } else {
                  logger.debug(`Project '${qualifiedProjectId}' wasn't found`)
                }
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
  routeApiMethod({
    method: ['POST',],
    path: 'stripe/checkout',
    config: {
      handler: stripeApi.stripeCheckout,
    },
  })
}
