'use strict'
let component = require('omniscient')
let h = require('react-hyperscript')
let logger = require('js-logger-aknudsen').get('userProfile')
let S = require('underscore.string.fp')
let CryptoJS = require('crypto-js')
let R = require('ramda')

let account = require('../../account')
let {nbsp,} = require('../../specialChars')
let datetime = require('../../datetime')

let getAvatarUrl = (user) => {
  if (!S.isBlank(user.avatarUrl)) {
    logger.debug(`User has an avatar URL: '${user.avatarUrl}'`)
    return user.avatarUrl
  } else {
    logger.debug(`User has no avatar URL, using Gravatar`)
    let email = user.email
    let hash = CryptoJS.MD5(email).toString(CryptoJS.enc.Hex)
    let gravatarUrl = `http://www.gravatar.com/avatar/${hash}?d=identicon&s=230`
    logger.debug(`Generated gravatar url:`, gravatarUrl)
    return gravatarUrl
  }
}

module.exports = component('VCard', ({cursor, user,}) => {
  let userProfileUrl = account.getUserProfileUrl(user.username)
  let userJoined = datetime.displayDateTextual(user.createdAt)

  return h('#vcard', [
    h('#user-avatar', [
      h('a', {href: userProfileUrl,}, [
        h('img', {src: getAvatarUrl(user), width: 230, height: 230,}),
      ]),
    ]),
    h('#user-name', user.name),
    h('#user-username.muted', user.username),
    h('hr'),
    h('#user-email.vcard-detail', [
      h('span.icon-envelop3', nbsp),
      h('span', user.email),
    ]),
    !S.isBlank(user.website) ? h('#user-website.vcard-detail', [
      h('span.icon-link', nbsp),
      h('a', {href: user.website, target: '_blank',}, user.website),
    ]) : null,
    user.soundCloud && user.soundCloud.username ? h('#user-soundcloud.vcard-detail', [
      h('span.icon-soundcloud'),
      h('a', {
        href: `https://soundcloud.com/${user.soundCloud.username}`, target: '_blank',
      }, user.soundCloud.name),
    ]) : null,
    h('#user-joined.vcard-detail', [
      h('span.icon-calendar', nbsp),
      h('span', `Joined ${userJoined}`),
    ]),
    h('#user-github-account.vcard-detail', [
      h('span.icon-github', nbsp),
      user.gitHubAccessToken == null ?
        h('a', {
          href: '#', target: '_blank',
          onClick: (event) => {
            event.preventDefault()

            logger.debug(`Getting GitHub access token...`)
            let array = new Uint32Array(48)
            crypto.getRandomValues(array)
            let appUri = cursor.get('appUri')
            let state = array.join('')
            let uriParameters = {
              client_id: cursor.get('gitHubClientId'),
              redirect_uri: `${appUri}/${userProfileUrl}/attach/github`,
              state,
              scope: 'admin:repo_hook',
            }
            let queryString = S.join('&', R.map(([key, value,]) => {
              return `${encodeURIComponent(key)}=${encodeURIComponent(value)}`
            }, R.toPairs(uriParameters)))
            let redirectUrl = `https://github.com/login/oauth/authorize?${queryString}`
            logger.debug(`Redirecting to GitHub: ${redirectUrl}`)
            window.location.href = redirectUrl
          },
        }, 'Attach to GitHub') :
        `Attached to GitHub account ${user.gitHubAccount}`,
    ]),
    !S.isBlank(user.about) ? h('div', [
      h('hr'),
      h('#user-about-short.vcard-detail', [
        h('a', {href: '#about',}, `About ${S.words(user.name)[0]}`),
      ]),
    ]) : null,
  ])
})
