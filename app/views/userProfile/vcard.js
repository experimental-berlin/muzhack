'use strict'
let component = require('omniscient')
let h = require('react-hyperscript')
let logger = require('js-logger').get('userProfile')
let S = require('underscore.string.fp')

let account = require('../../account')
let {nbsp,} = require('../../specialChars')
let datetime = require('../../datetime')

module.exports = component('VCard', (user) => {
  let userProfileUrl = account.getUserProfileUrl(user.username)
  let userJoined = datetime.displayDateTextual(user.createdAt)
  return h('#vcard', [
    h('#user-avatar', [
      h('a', {href: userProfileUrl,}, [
        h('img', {src: user.avatar, width: 230, height: 230,}),
      ]),
    ]),
    h('#user-name', user.name),
    h('#user-username.muted', user.username),
    h('hr'),
    h('#user-email.vcard-detail', [
      h('span.icon-envelop3', nbsp),
      h('span', user.email),
      !S.isBlank(user.website) ? h('#user-website.vcard-detail', [
        h('span.icon-link'),
        h('a', {href: user.website, target: '_blank',}, user.website),
      ]) : null,
      user.soundCloud != null ? h('#user-soundcloud.vcard-detail', [
        h('span.icon-soundcloud'),
        h('a', {
          href: `https://soundcloud.com/${user.soundCloud.username}`, target: '_blank',
        }, user.soundCloud.name),
      ]) : null,
      h('#user-joined.vcard-detail', [
        h('span.icon-calendar', nbsp),
        h('span', `Joined ${userJoined}`),
      ]),
      !S.isBlank(user.about) ? h('div', [
        h('hr'),
        h('#user-about-short.vcard-detail', [
          h('a', {href: '#about',}, `About ${userFirstName}`),
        ]),
      ]) : null,
    ]),
  ])
})
