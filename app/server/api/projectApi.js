'use strict'
let logger = require('js-logger-aknudsen').get('server.api.project')
let Boom = require('boom')
let S = require('underscore.string.fp')
let JSZip = require('jszip')
let R = require('ramda')
let r = require('rethinkdb')
let request = require('request')
let Yaml = require('yamljs')
let Promise = require('bluebird')
let gcloud = require('gcloud')
let moment = require('moment')

let licenses = require('../../licenses')
let {trimWhitespace,} = require('../../stringUtils')
let {getEnvParam,} = require('../environment')
let {InvalidProjectId,} = require('../../validators')
let {withDb, connectToDb, closeDbConnection,} = require('../db')
let {notFoundError, validationError, alreadyExistsError,} = require('../../errors')
let {getUserWithConn,} = require('./apiUtils')
let ajax = require('../../ajax')

let getCloudStorageUrl = (path) => {
  let bucketName = getEnvParam(`GCLOUD_BUCKET`)
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

let getStorageBucket = () => {
  let bucketName = getEnvParam(`GCLOUD_BUCKET`)
  return gcs.bucket(bucketName)
}

let getProject = (request, reply) => {
  let {owner, projectId,} = request.params
  let qualifiedProjectId = `${owner}/${projectId}`
  logger.debug(`Getting project '${qualifiedProjectId}'`)
  withDb(reply, (conn) => {
    return r.table('projects')
      .get(qualifiedProjectId)
      .run(conn)
      .then((project) => {
        if (project != null && !project.placeholder) {
          logger.debug(`Found project '${qualifiedProjectId}':`, project)
          return project
        } else {
          logger.debug(`Could not find project '${qualifiedProjectId}'`)
          return Boom.notFound()
        }
      })
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
  logger.debug(`Waiting on ${downloadPromises.length} download promise(s)`)
  return Promise.all(downloadPromises)
    .then(() => {
      logger.debug(`All files added to zip`)
      logger.debug(`Uploading zip file to Cloud Storage...`)
      let bucket = getStorageBucket()
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
                      url: getCloudStorageUrl(cloudFilePath),
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
      logger.warn(`Failed to download files:`, error.stack)
      throw new Error(error)
    })
}

let createProjectPlaceholder = (owner, projectParams) => {
  let qualifiedProjectId = `${owner}/${projectParams.id}`
  logger.debug(`Creating placeholder in database for project ${qualifiedProjectId}...`)
  return connectToDb()
    .then((conn) => {
      return r.table('projects')
        .insert({
          id: qualifiedProjectId,
          placeholder: true,
        }, {
          conflict: 'error',
        })
        .run(conn)
        .then((result) => {
          if (result.errors === 0) {
            logger.debug(`Successfully inserted placeholder for project ${qualifiedProjectId}`)
          } else {
            if (result.first_error.startsWith(`Duplicate primary key`)) {
              logger.debug(`Project ${qualifiedProjectId} already exists in database`)
              throw alreadyExistsError()
            } else {
              logger.warn(
                `Encountered error while inserting placeholder for project ` +
                `${qualifiedProjectId}:`, result.first_error)
              throw new Error(
                `Encountered error while inserting placeholder for project ${qualifiedProjectId}`)
            }
          }
        })
        .finally(() => {
          closeDbConnection(conn)
        })
    })
}

let createProjectFromParameters = (projectParams, owner, ownerName) => {
  logger.debug(`Got project parameters`, projectParams)
  projectParams = sanitizeProjectParams(projectParams)
  let qualifiedProjectId = `${owner}/${projectParams.projectId}`

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

let createProjectFromGitHub = (owner, ownerName, projectParams) => {
  logger.debug(
    `Creating project slaved to GitHub repository '${projectParams.gitHubOwner}/` +
      `${projectParams.gitHubProject}:`)
  let {gitHubOwner, gitHubProject,} = projectParams
  getProjectParamsForGitHubRepo(owner, null, gitHubOwner, gitHubProject)
    .then((newProjectParams) => {
      return createProjectFromParameters(newProjectParams, owner, ownerName)
        .then((project) => {
          let returnValue = {
            qualifiedProjectId: `${project.id}`,
          }
          let appEnvironment = getEnvParam(`APP_ENVIRONMENT`, null)
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
                        logger.debug(`Successfully set webhook ID on project, returning:`,
                          returnValue)
                        return returnValue
                      })
                      .finally(() => {
                        closeDbConnection(conn)
                      })
                  })
              })
          } else {
            logger.debug(
              `Not installing GitHub webhook, since we aren't in a supported environment`)
            logger.debug(`Replying with:`, returnValue)
            return returnValue
          }
        })
    })
}

let processPicturesFromProjectParams = Promise.method((projectParams, owner) => {
  let pictures = R.map((picture) => {
    let projectId = projectParams.projectId || projectParams.id
    return R.merge(picture, {
      cloudPath: `u/${owner}/${projectId}/pictures/${picture.name}`,
    })
  }, projectParams.pictures)
  return Promise.map(pictures, R.partial(ajax.postJson, ['http://localhost:10000/jobs',]))
    .then((pictures) => {
      return R.merge(projectParams, {
        pictures,
      })
    })
})

let createProjectFromClientApp = (owner, ownerName, projectParams) => {
  return processPicturesFromProjectParams(projectParams, owner)
    .then((newProjectParams) => {
      return createProjectFromParameters(newProjectParams, owner, ownerName)
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
    return createProjectPlaceholder(owner, projectParams)
      .then(() => {
        let qualifiedProjectId = `${owner}/${projectParams.id}`
        let isGitHubRepo = !S.isBlank(projectParams.gitHubOwner) &&
          !S.isBlank(projectParams.gitHubProject)
        let func
        if (isGitHubRepo) {
          func = createProjectFromGitHub
        } else {
          func = createProjectFromClientApp
        }
        return Promise.method(func)(owner, ownerName, projectParams)
          .then((value) => {
              logger.debug(`Creating project ${qualifiedProjectId} succeeded, not removing placeholder`)
              reply(value)
            }, (error) => {
              logger.debug(
                `Creating project ${qualifiedProjectId} failed, removing placeholder`)
              return connectToDb()
                .then((conn) => {
                  logger.debug(`Deleting placeholder project ${qualifiedProjectId}...`)
                  return r.table('projects')
                    .get(qualifiedProjectId)
                    .delete()
                    .run(conn)
                })
                .finally(() => {
                  throw error
                })
            })
          })
  }
}

let boundPromisify = (methodName, context) => {
  let method = context[methodName]
  if (method == null) {
    throw new Error(`Object has no method '${methodName}'`)
  }
  return Promise.promisify(method, {context,})
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
    let bucket = getStorageBucket()
    let boundFile = R.bind(bucket.file, bucket)
    return Promise.map(filePaths, R.pipe(boundFile,
        R.curryN(2, boundPromisify)('delete'), R.call), {concurrency: 10,})
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
        return r.table('projects')
          .get(qualifiedProjectId)
          .run(conn)
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
                return r.table('projects')
                  .get(qualifiedProjectId)
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
    projectParams.projectId = projectId
    processPicturesFromProjectParams(projectParams, owner)
      .then((newProjectParams) => {
        realUpdateProject(owner, ownerName, projectId, newProjectParams, reply)
      }, (error) => {
        logger.error(`Processing pictures failed:`, error.stack)
        reply(Boom.badImplementation())
      })
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
          logger.debug(`Couldn't find resource ${url}`)
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

let copyFilesToCloudStorage = (files, dirPath, owner, projectId) => {
  let bucket = getStorageBucket()
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
                  url: getCloudStorageUrl(cloudFilePath),
                  cloudPath: cloudFilePath,
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

let unresolvedPicturePromises = {}

let getProjectParamsForGitHubRepo = (owner, projectId, gitHubOwner, gitHubProject) => {
  let qualifiedRepoId = `${gitHubOwner}/${gitHubProject}`
  let downloadFile = R.partial(downloadFileFromGitHub, [gitHubOwner, gitHubProject,])
  let [gitHubClientId, gitHubClientSecret,] = getGitHubCredentials()

  let getDirectory = (path, recurse=false) => {
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
      let processPicturesPromise = Promise.map(copyPicturesPromise, R.partial(ajax.postJson,
          ['http://localhost:10000/jobs',]))
      return Promise.all([processPicturesPromise, copyFilesPromise,])
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

let sanitizeProjectParams = (projectParams) => {
  logger.debug(`Sanitizing project parameters`)
  let projectId = trimWhitespace(projectParams.id)
  let validator = new InvalidProjectId(projectId)
  if (validator.isInvalid) {
    logger.debug(`Invalid project ID: '${projectId}'`)
    throw validationError(validator.errorText)
  }

  verifyLicense(projectParams)

  let tags = R.map((tag) => {
    tag = trimWhitespace(tag)
    if (!/^[a-z0-9-]+$/.test(tag)) {
      logger.debug(`Invalid tag detected '${tag}'`)
      throw validationError(`Tags must consist of lowercase alphanumeric characters or dashes`)
    }
    return tag
  }, projectParams.tags)

  return R.merge(projectParams, {
    id: projectId,
    projectId,
    tags,
  })
}

let removeWebhook = (project, owner) => {
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
          return ajax.delete(
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

let deleteProject = (request, reply) => {
  let removeFolder = () => {
    let dirPath = `u/${owner}/${request.params.id}`
    logger.debug(`Removing folder '${dirPath}'...`)
    logger.debug(`Listing folder contents...`)
    let bucket = getStorageBucket()
    return boundPromisify('deleteFiles', bucket)({prefix: `${dirPath}/`, force: true,})
  }

  let owner = request.params.owner
  let qualifiedProjectId = `${owner}/${request.params.id}`

  logger.debug(`Received request to delete project '${qualifiedProjectId}'`)
  if (owner !== request.auth.credentials.username) {
    reply(Boom.unauthorized(
      `You are not allowed to delete projects for others than your own user`))
  } else {
    withDb(reply, (conn) => {
      return r.table('projects')
        .get(qualifiedProjectId)
        .run(conn)
        .then((project) => {
          if (project != null) {
            return r.table('projects').get(qualifiedProjectId).delete().run(conn)
              .then(removeFolder)
              .then(() => {
                return removeWebhook(project, owner)
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
}

module.exports = {
  getProject,
  createProject,
  deleteProject,
  updateProject,
}
