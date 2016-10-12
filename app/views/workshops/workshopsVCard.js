'use strict'
let component = require('omniscient')
let h = require('react-hyperscript')
let logger = require('@arve.knudsen/js-logger').get('userProfile')
let S = require('underscore.string.fp')
let CryptoJS = require('crypto-js')
let R = require('ramda')

let account = require('../../account')
let {nbsp,} = require('../../specialChars')
let datetime = require('../../datetime')
let userManagement = require('../../userManagement')

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
  let loggedInUser = userManagement.getLoggedInUser(cursor)
  let isLoggedInUser = loggedInUser != null && loggedInUser.username === user.username

  logger.debug(`SoundCloud:`, user.soundCloud)
  return h('#vcard', [
    h('#user-avatar', [
      h('a', {href: userProfileUrl,}, [
        h('img', {src: getAvatarUrl(user),}),
      ]),
    ]),
    h('#user-name', user.name),
    h('#user-username.muted', user.username),
    h('hr'),
    !S.isBlank(user.website) ? h('#user-website.vcard-detail', [
      h('span.icon-link', nbsp),
      h('a', {href: user.website, target: '_blank',}, user.website),
    ]) : null,
    user.facebook != null ? h('#user-facebook.vcard-detail', [
      h('span.icon-facebook2', nbsp),
      h('a', {href: user.facebook, target: '_blank',}, `Facebook`),
    ]) : null,
    user.twitter != null ? h('#user-twitter.vcard-detail', [
      h('span.icon-twitter', nbsp),
      h('a', {href: `https://twitter.com/${user.twitter}`, target: '_blank',}, `Twitter`),
    ]) : null,
    user.soundCloud != null && user.soundCloud.username ? h('#user-soundcloud.vcard-detail', [
      h('span.icon-soundcloud', nbsp),
      h('a', {
        href: `https://soundcloud.com/${user.soundCloud.username}`, target: '_blank',
      }, 'SoundCloud'),
    ]) : null,
    user.youtube != null ? h('#user-youtube.vcard-detail', [
      h('span.icon-youtube3', nbsp),
      h('a', {
        href: `https://youtube.com/user/${user.youtube}`, target: '_blank',
      }, 'Youtube'),
    ]) : null,
    user.vimeo != null ? h('#user-vimeo.vcard-detail', [
      h('span.icon-vimeo', nbsp),
      h('a', {
        href: `https://vimeo.com/user${user.vimeo}`, target: '_blank',
      }, 'Vimeo'),
    ]) : null,
    h('#user-joined.vcard-detail', [
      h('span.icon-calendar', nbsp),
      h('span', `Joined ${userJoined}`),
    ]),
    isLoggedInUser ? h('#user-github-account.vcard-detail', [
      h('span.icon-github', nbsp),
      user.gitHubAccessToken == null ?
        h('a', {
          href: '#', target: '_blank',
          onClick: (event) => {
            event.preventDefault()

            logger.debug(`Getting GitHub access token...`)
            let array = new Uint32Array(48)
            crypto.getRandomValues(array)
            let appUri = S.rtrim('/', cursor.get('appUri'))
            let state = array.join('')
            let uriParameters = {
              client_id: cursor.get('gitHubClientId'),
              redirect_uri: `${appUri}${userProfileUrl}/attach/github`,
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
    ]) : null,
    !S.isBlank(user.about) ? h('div', [
      h('hr'),
      h('#user-about-short.vcard-detail', [
        h('a', {href: '#about',}, `About ${S.words(user.name)[0]}`),
      ]),
    ]) : null,
  ])
})
