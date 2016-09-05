'use strict'
let component = require('omniscient')
let h = require('react-hyperscript')
let R = require('ramda')
let logger = require('js-logger-aknudsen').get('createProject')
let S = require('underscore.string.fp')
let React = require('react')
let ReactAutoComplete = React.createFactory(require('@arve.knudsen/react-autocomplete'))
let immstruct = require('immstruct')
let Promise = require('bluebird')

let userManagement = require('../../userManagement')
let licenses = require('../../licenses')
let FocusingInput = require('../focusingInput')
let {nbsp,} = require('../../specialChars')
let ajax = require('../../ajax')
let {Loading, InputLoading,} = require('./loading')
let {DescriptionEditor, InstructionsEditor, PicturesEditor,
  FilesEditor,} = require('./editors')
let {trimWhitespace,} = require('../../stringUtils')
let {InvalidProjectId, InvalidTag,} = require('../../validators')
let editAndCreateProject = require('./editAndCreateProject')
let {renderFieldError,} = editAndCreateProject

let uploadProject
let router
let getUser
if (__IS_BROWSER__) {
  uploadProject = require('./uploadProject')
  router = require('../../router')

  require('./editAndCreate.styl')
  require('./createProject.styl')
  require('dropzone/src/dropzone.scss')
  require('../dropzone.styl')
} else {
  getUser = require('../../server/api/apiUtils').getUser
}

let createProject = Promise.method((cursor) => {
  let createCursor = cursor.cursor('createProject')
  let input = createCursor.toJS()
  let username = userManagement.getLoggedInUser(cursor).username

  let inputExtended = R.merge(input, {
    projectId: input.id,
    owner: username,
  })

  return uploadProject(inputExtended, createCursor, cursor)
    .then(({title, summary, description, instructions, tags, licenseId, username, pictureFiles,
        files,}) => {
      logger.debug(`Picture files:`, pictureFiles)
      logger.debug(`Files:`, files)
      logger.debug(
        `title: ${title}, summary: ${summary}, description: ${description}, ` +
        `tags: ${S.join(`,`, tags)}`)
      let qualifiedProjectId = `${username}/${input.id}`
      let data = {
        id: input.id,
        title,
        summary,
        description,
        instructions,
        tags,
        licenseId,
        pictures: pictureFiles,
        files,
      }
      logger.debug(`Creating project '${qualifiedProjectId}'...:`, data)
      cursor.cursor('createProject').set('isLoading', 'Saving project...')
      return ajax.postJson(`/api/projects/${username}`, data)
        .then(() => {
          logger.info(`Successfully created project '${qualifiedProjectId}' on server`)
          return router.goTo(`/u/${qualifiedProjectId}`)
        }, (error) => {
          cursor.cursor('createProject').set('isLoading', false)
          logger.warn(`Failed to create project '${qualifiedProjectId}' on server: ${error}`,
            error.stack)
        })
      }, (error) => {
        logger.warn(`Uploading files/pictures failed: ${error}`, error.stack)
        cursor.cursor('createProject').set('isLoading', false)
      })
})

let createProjectFromGitHub = Promise.method((cursor) => {
  let createCursor = cursor.cursor('createProject')
  let repositoryName = createCursor.getIn([`gitHub`, `gitHubRepositoryName`,])
  let username = userManagement.getLoggedInUser(cursor).username
  let [gitHubOwner, gitHubProject,] = S.wordsDelim('/', repositoryName)
  logger.debug(`Creating project from GitHub on server...`)
  return ajax.postJson(`/api/projects/${username}`, {
    gitHubOwner,
    gitHubProject,
  })
    .then(({qualifiedProjectId,}) => {
      logger.info(
        `Successfully created project '${qualifiedProjectId}' from GitHub repository` +
          `'${repositoryName}' on server`)
      return router.goTo(`/u/${qualifiedProjectId}`)
    })
})

let inputChangeHandler = (fieldName, handler) => {
  return editAndCreateProject.inputChangeHandler(fieldName, 'createProject', handler)
}

let gitHubInputChangeHandler = (fieldName, handler) => {
  return editAndCreateProject.inputChangeHandler(fieldName, ['createProject', 'gitHub',], handler)
}

let checkProjectIdTimeout = null

let checkAvailabilityOfProjectId = (projectId, cursor) => {
  return new Promise((resolve, reject) => {
    checkProjectIdTimeout = setTimeout(() => {
      cursor.set(`isCheckingId`, true)
      logger.debug(`Checking whether project ID ${projectId} is available`)
      ajax.getJson(`/api/isProjectIdAvailable?projectId=${projectId}`)
        .then((isAvailable) => {
          if (isAvailable) {
            logger.debug(`Project ID ${projectId} is available`)
            resolve()
          } else {
            logger.debug(`Project ID ${projectId} is not available`)
            resolve(`ID ${projectId} is not available`)
          }
        }, reject)
        .finally(() => {
          cursor.set(`isCheckingId`, false)
        })
    }, 500)
  })
}

let renderCreateStandaloneProject = (cursor) => {
  let createCursor = cursor.cursor('createProject')
  let input = createCursor.toJS()
  let errors = input.errors
  logger.debug(`Rendering validation errors:`, errors)
  return [
    h('.input-group', [
      FocusingInput({
        id: 'id-input', placeholder: 'Project ID',
        value: input.id,
        onChange: inputChangeHandler('id', (event, createCursor) => {
          if (checkProjectIdTimeout != null) {
            clearTimeout(checkProjectIdTimeout)
          }

          let projectId = trimWhitespace(event.target.value)
          logger.debug(`Project ID changed: '${projectId}'`)
          createCursor = createCursor.set('id', projectId)

          if (S.isBlank(projectId)) {
            return `ID must be filled in`
          } else {
            let projectIdValidator = new InvalidProjectId(projectId)
            if (projectIdValidator.isInvalid) {
              return projectIdValidator.errorText
            } else {
              if (!S.isBlank(projectId)) {
                return checkAvailabilityOfProjectId(projectId, createCursor)
              }
            }
          }
        }),
      }),
      input.isCheckingId ? InputLoading() : null,
      renderFieldError(errors, 'id'),
    ]),
    h('.input-group', [
      h('input#title-input', {
        type: 'text',
        placeholder: 'Project title',
        value: input.title,
        onChange: inputChangeHandler('title', (event, createCursor) => {
          let title = event.target.value
          logger.debug(`Project title changed: '${title}'`)
          createCursor.set('title', title)
          if (S.isBlank(title)) {
            return `Title must be filled in`
          } else {
            return null
          }
        }),
      }),
      renderFieldError(errors, 'title'),
    ]),
    h('.input-group', [
      h('input#tags-input', {
        type: 'text',
        placeholder: 'Project tags',
        value: input.tagsString,
        onChange: inputChangeHandler('tags', (event, createCursor) => {
          logger.debug(`Project tags changed: '${event.target.value}'`)
          let tagsString = event.target.value
          createCursor.set('tagsString', tagsString)
          let tags = R.reject(
            S.isBlank,
            R.map(trimWhitespace, S.wordsDelim(`,`, tagsString))
          )
          if (R.isEmpty(tags)) {
            logger.debug(`No tags supplied`)
            return `No tags supplied`
          } else {
            logger.debug(`Checking tags for validity:`, tags)
            let validator = R.find(R.prop('isInvalid'), R.map(R.construct(InvalidTag), tags))
            if (validator != null) {
              return validator.errorText
            } else {
              return null
            }
          }
        }),
      }),
      nbsp,
      h('span.icon-tags2'),
      renderFieldError(errors, 'tags'),
    ]),
    h('.input-group', [
      h('select#license-select', {
        placeholder: 'License',
        value: input.licenseId,
        onChange: (event) => {
          logger.debug(`Project license changed: '${event.target.value}'`)
          createCursor.set('licenseId', event.target.value)
        },
      }, R.map(([id, license,]) => {
        return h('option', {value: id,}, license.name)
      }, R.toPairs(licenses))),
    ]),
    h('.input-group', [
      h('input#summary-input', {
        type: 'text',
        placeholder: 'Project summary - One to two sentences',
        value: input.summary,
        onChange: inputChangeHandler('summary', (event, createCursor) => {
          let summary = event.target.value
          logger.debug(`Project summary changed: '${summary}'`)
          createCursor.set('summary', summary)
          if (S.isBlank(summary)) {
            return `Summary must be filled in`
          } else {
            return null
          }
        }),
      }),
      renderFieldError(errors, 'summary'),
    ]),
    h('#description-editor',  {
      onChange: inputChangeHandler('description', (event, createCursor) => {
        let description = trimWhitespace(event.target.value)
        logger.debug(`Description changed:`, description)
        return S.isBlank(description) ? `Description must be filled in` : null
      }),
    }, [
      DescriptionEditor(createCursor),
      renderFieldError(errors, 'description'),
    ]),
    h('#pictures-editor', [
      PicturesEditor({
        cursor: createCursor,
        changeHandler: inputChangeHandler('pictures', (event, createCursor) => {
          logger.debug(`Pictures changed:`, event.target.value)
          return R.isEmpty(event.target.value) ? `At least one picture must be supplied` : null
        }),
      }),
      renderFieldError(errors, 'pictures'),
    ]),
    h('#instructions-editor', [
      InstructionsEditor(createCursor),
    ]),
    h('#files-editor', [
      FilesEditor(createCursor),
    ]),
    h('#create-buttons.button-group', [
      h('button#create-project.pure-button.pure-button-primary', {
        onClick: () => {
          logger.debug(`Create button clicked`, createCursor)
          createCursor = createCursor.update((current) => {
            current = current.set('isLoading', 'Creating project...')
            current = current.set(`failureBanner`, null)
            return current
          })
          createProject(cursor)
            .catch((error) => {
              createCursor.set('isLoading', false)
              throw error
            })
        },
        disabled: !input.isReady,
      }, 'Create'),
      h('button#cancel-create.pure-button', {
        onClick: () => {
          logger.debug(`Cancel button clicked`)
          // TODO: Ask user if there are modifications
          router.goTo('/')
        },
      }, 'Cancel'),
    ]),
  ]
}

let AutoComplete = component('AutoComplete', ({cursor,}) => {
  let showSuggestions = false
  let createCursor = cursor.cursor('createProject')
  let isLoading = !!createCursor.getIn([`gitHub`, `isLoadingGitHubRepositories`,])
  let gitHubRepositories = createCursor.cursor([`gitHub`, `gitHubRepositories`,]).toJS()
  let autoCompleteValue = createCursor.getIn([`gitHub`, 'gitHubRepositoryName',])
  let gitHubRepositoryNames = R.map(R.compose(R.toLower, R.prop('full_name')), gitHubRepositories)
  let autoCompleteItems = R.filter(S.include(autoCompleteValue.toLowerCase()),
    gitHubRepositoryNames)
  logger.debug(`GitHub repositories:`, autoCompleteItems)
  logger.debug(
    `Rendering AutoComplete, is loading: ${isLoading}`, createCursor.toJS())
  return ReactAutoComplete({
    inputProps: {
      name: 'repository',
      placeholder: `GitHub repository`,
      disabled: isLoading,
      className: `github-autocomplete`,
    },
    ref: 'autocomplete',
    value: autoCompleteValue,
    items: autoCompleteItems,
    getItemValue: R.identity,
    onSelect: gitHubInputChangeHandler('gitHubRepositoryName', (value, gitHubCursor) => {
      logger.debug(`Repository selected: '${value}'`)
      gitHubCursor.set(`gitHubRepositoryName`, value)
    }),
    onChange: gitHubInputChangeHandler('gitHubRepositoryName', (event, gitHubCursor) => {
      let repoName = trimWhitespace(event.target.value)
      logger.debug(`GitHub repository changed: '${repoName}':`, gitHubCursor.toJS())
      gitHubCursor.set('gitHubRepositoryName', repoName)
      logger.debug(`After setting:`, gitHubCursor.toJS())
      if (S.isBlank(repoName)) {
        return `GitHub repository must be filled in`
      } else if (!R.contains(repoName.toLowerCase(), gitHubRepositoryNames)) {
        return `Please select a valid GitHub repository`
      } else {
        return null
      }
    }),
    renderItem: (item, isHighlighted) => {
      return h('.autocomplete-item', {
        style: isHighlighted ? {
          color: 'white',
          background: 'hsl(200, 50%, 50%)',
          padding: '2px 6px',
          cursor: 'default',
        } : {
          padding: '2px 6px',
          cursor: 'default',
        },
        key: item,
        id: item,
      }, item)
    },
  })
})

let checkGitHubIdTimeout = null

let renderCreateProjectFromGitHub = (cursor) => {
  let createCursor = cursor.cursor('createProject')
  let input = createCursor.toJS()
  let errors = input.gitHub.errors
  let isGitHubRepositorySelected = !S.isBlank(input.gitHub.gitHubRepositoryName) &&
    !input.gitHub.isLoadingGitHubRepositories
  logger.debug(`Rendering form to import project from GitHub`)
  return [
    h('.input-group', [
      AutoComplete({
        cursor,
      }),
      input.gitHub.isLoadingGitHubRepositories ? InputLoading() : null,
    ]),
    renderFieldError(errors, 'gitHubRepositoryName'),
    h('#create-buttons.button-group', [
      h('button#create-project.pure-button.pure-button-primary', {
        onClick: () => {
          logger.debug(`Create button clicked`)
          cursor = cursor.mergeDeep({
            createProject: {
              isLoading: 'Creating project...',
              failureBanner: null,
            },
          })
          createProjectFromGitHub(cursor)
            .catch((error) => {
              let repositoryName = createCursor.getIn([`gitHub`, `gitHubRepositoryName`,])
              logger.debug(
                `Creating project from GitHub repository '${repositoryName}' failed on server:`,
                  error)
              createCursor.update((current) => {
                current = current.set('isLoading', false)
                current = current.set(`failureBanner`, error.message)
                return current
              })
            })
        },
        disabled: !input.gitHub.isReady,
      }, 'Create'),
      h('button#cancel-create.pure-button', {
        onClick: () => {
          logger.debug(`Cancel button clicked`)
          // TODO: Ask user if there are modifications
          router.goTo('/')
        },
      }, 'Cancel'),
    ]),
  ]
}

let loadGitHubRepositories = () => {
  let getPagedListFromGitHub = (url) => {
    let recurse = (pageUrl, allResults) => {
      return getGitHubJson(pageUrl, {includeResponse: true,})
        .spread((results, response) => {
          let linkHeader = response.headers.Link || ''
          let matches = R.match(/<([^>]+)>; rel="next"/, linkHeader)
          if (!R.isEmpty(matches)) {
            let nextUrl = matches[1]
            logger.debug(`GitHub indicates we need to fetch more results: ${nextUrl}`)
            return recurse(nextUrl, R.concat(allResults, results))
          } else {
            return R.concat(allResults, results)
          }
        })
    }

    return recurse(url, [])
  }

  let getGitHubJson = (url, includeResponse) => {
    return ajax.getJson(url, null, {
      headers: {Authorization: `token ${gitHubAccessToken}`,},
      includeResponse,
    })
  }

  let cursor = immstruct.instance('state').reference().cursor()
  logger.debug(`Loading GitHub repositories...`)
  let createCursor = cursor.cursor(`createProject`)
  let gitHubAccessToken = createCursor.get('gitHubAccessToken')
  return getGitHubJson(`https://api.github.com/user`)
    .then((gitHubUser) => {
      logger.debug(`Successfully got GitHub user: ${gitHubUser.login}`)
      logger.debug(`Getting user's repositories and organizations...`)
      return Promise.map([gitHubUser.repos_url, gitHubUser.organizations_url,],
          getPagedListFromGitHub)
        .then(([repositories, organizations,]) => {
          return Promise.map(organizations, (organization) => {
            return getPagedListFromGitHub(organization.repos_url)
          })
            .then(R.flatten)
            .then((orgRepositories) => {
              let allRepositories = R.concat(repositories, orgRepositories)
              createCursor.mergeDeep({
                gitHub: {
                  gitHubRepositories: allRepositories,
                  isLoadingGitHubRepositories: false,
                },
              })
            })
        })
    })
}

let CreateProjectPad = component('CreateProjectPad', (cursor) => {
  logger.debug(`Rendering CreateProjectPad`)
  let createCursor = cursor.cursor('createProject')
  let gitHubAccessToken = createCursor.get('gitHubAccessToken')
  let shouldCreateStandalone = createCursor.get('shouldCreateStandalone')
  let failureBanner = createCursor.get('failureBanner')
  if (gitHubAccessToken == null) {
    logger.debug(`Have no GitHub access token - not letting user import from GitHUb`)
  } else {
    logger.debug(`Have a GitHub access token - letting user import from GitHUb`)
  }
  return h('#create-project-pad', [
    failureBanner != null ? h('#failure-banner', failureBanner) : null,
    gitHubAccessToken != null ? h('.input-group', [
      h('input', {
        type: 'radio', name: 'projectType', checked: shouldCreateStandalone,
        onChange: () => {
          logger.debug(`Standalone project creation selected`)
          createCursor.set('shouldCreateStandalone', true)
        },
      }),
      nbsp,
      'Standalone',
      nbsp,
      h('input', {
        type: 'radio', name: 'projectType', checked: !shouldCreateStandalone,
        onChange: () => {
          logger.debug(`GitHub project creation selected`)
          createCursor.mergeDeep({
            shouldCreateStandalone: false,
            gitHub: {
              isLoadingGitHubRepositories: true,
            },
          })
          loadGitHubRepositories()
        },
      }),
      nbsp,
      'GitHub',
    ]) : null,
    h('#project-inputs', shouldCreateStandalone ?
      renderCreateStandaloneProject(cursor) : renderCreateProjectFromGitHub(cursor)),
    ])
})

let loadGitHubAccessToken = Promise.method((loggedInUser) => {
  if (__IS_BROWSER__) {
    logger.debug(`Loading logged in user ${loggedInUser.username}...`)
    return ajax.getJson(`/api/users/${loggedInUser.username}`)
      .then((user) => {
        // logger.debug(`Loading user ${user.username} JSON succeeded:`, user)
        return user.gitHubAccessToken
      }, (error) => {
        logger.warn(`Loading user ${loggedInUser.username} JSON failed:`, error)
        throw error
      })
  } else {
    return getUser(loggedInUser.username)
      .then((user) => {
        return user.gitHubAccessToken
      })
  }
})

module.exports = {
  requiresLogin: true,
  render: (cursor) => {
    let createCursor = cursor.cursor('createProject')
    if (!createCursor.get('isLoading')) {
      return CreateProjectPad(cursor)
    } else {
      return Loading(createCursor)
    }
  },
  loadData: (cursor) => {
    let state = {
      createProject: {
        isLoading: false,
        licenseId: 'cc-by-4.0',
        shouldCreateStandalone: true,
        isReady: false,
        isCheckingId: false,
        errors: {
          id: null,
          title: null,
          tags: null,
          description: null,
          pictures: null,
        },
        gitHub: {
          isReady: false,
          gitHubRepositories: [],
          isLoadingGitHubRepositories: true,
          gitHubRepositoryName: '',
          errors: {
            gitHubRepositoryName: null,
          },
        },
      },
    }

    let loggedInUser = userManagement.getLoggedInUser(cursor)
    if (loggedInUser != null) {
      return loadGitHubAccessToken(loggedInUser)
        .then((gitHubAccessToken) => {
          state = R.mergeWith(R.merge, state, {
            createProject: {
              gitHubAccessToken,
            },
          })
          return state
        })
    } else {
      return state
    }
  },
}
