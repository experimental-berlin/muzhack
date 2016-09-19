'use strict'
let S = require('underscore.string.fp')
let logger = require('@arve.knudsen/js-logger').get('discourse')
let h = require('react-hyperscript')

let ajax = require('./ajax')
let userManagement = require('./userManagement')

module.exports = {
  requiresLogin: true,
  shouldRenderServerSide: false,
  render: (cursor) => {
    let discourse = cursor.cursor('discourse').toJS()
    let error = discourse.error
    logger.debug(`Handling Discourse SSO request error:`, error)
    let message = discourse.error != null ? discourse.error.message : ''
    return h('div', [
      h('h1', 'Discourse SSO Error'),
      h('#discourse-sso-error', `Verification of Discourse SSO request failed: ${message}.`),
    ])
  },
  loadData: (cursor, params, queryParams) => {
    if (userManagement.getLoggedInUser(cursor) == null) {
      // TODO: Make sure this doesn't get called when we need to redirect to login
      logger.warn(`User isn't logged in, returning`)
      return
    }

    logger.debug(`Loading data, params/queryParams:`, params, queryParams)
    let error = null
    let discourseCursor = cursor.cursor('discourse')
    if (S.isBlank(queryParams.sso) || S.isBlank(queryParams.sig)) {
      logger.debug(`Received bad parameters from Discourse SSO request`)
      return {
        discourse: {
          error: new Error(`Bad parameters from Discourse SSO request`),
        },
      }
    } else {
      let payload = decodeURIComponent(queryParams.sso)
      let sig = decodeURIComponent(queryParams.sig)
      logger.debug(`Calling server to verify Discourse SSO parameters`)
      return ajax.postJson('/api/verifyDiscourseSso', {
        payload,
        sig,
      })
        .then((result) => {
          logger.debug(`Got SSO verification result:`, result)
          let [respPayload, respSig, discourseUrl,] = result
          logger.info(
            `Server successfully verified Discourse call - redirecting to '${discourseUrl}'`)
          window.location = `${discourseUrl}/session/sso_login?sso=${respPayload}&sig=${respSig}`
          return {}
        }, (error) => {
          logger.error(`Server failed to verify Discourse call: ${error}`)
          return {
            discourse: {
              error: error,
            },
          }
        })
    }
  },
}
