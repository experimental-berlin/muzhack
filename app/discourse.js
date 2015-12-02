'use strict'
let S = require('underscore.string.fp')
let logger = require('js-logger-aknudsen').get('discourse')
let h = require('react-hyperscript')

let ajax = require('./ajax')

module.exports = {
  requiresLogin: true,
  render: (cursor) => {
    let discourse = cursor.cursor('discourse').toJS()
    let error = discourse.error
    logger.debug(`Handling Discourse SSO request error:`, error)
    return h('div', [
      h('h1', 'Discourse SSO Error'),
      h('#discourse-sso-error', `Verification of Discourse SSO request failed: ${error}.`),
    ])
  },
  loadData: (cursor, params, queryParams) => {
    let error = null
    let discourseCursor = cursor.cursor('discourse')
    if (S.isBlank(queryParams.sso) || S.isBlank(queryParams.sig)) {
      logger.debug(`Received bad parameters from Discourse SSO request`)
      return {
        discourse: {
          error: `Bad parameters from Discourse SSO request`,
        },
      }
    } else {
      let payload = decodeURIComponent(queryParams.sso)
      let sig = decodeURIComponent(queryParams.sig)
      logger.debug(`Calling server to verify Discourse SSO parameters`)
      return ajax.postJson('verifyDiscourseSso', {
        payload,
        sig,
      })
        .then((result) => {
          let [respPayload, respSig, discourseUrl,] = result
          logger.info(
            `Server successfully verified Discourse call - redirecting to '${discourseUrl}'`)
          window.location = `${discourseUrl}/session/sso_login?sso=${respPayload}&sig=${respSig}`
          return {}
        }, (error) => {
          logger.error(`Server failed to verify Discourse call: ${error.message}`)
          return {
            discourse: {
              error: error.message,
            },
          }
        })
    }
  },
}
