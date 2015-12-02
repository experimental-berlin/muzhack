'use strict'
let explore = require('./views/explore')
let displayProject = require('./views/project/displayProject')
let editProject = require('./views/project/editProject')
let login = require('./views/login')
let userProfile = require('./views/userProfile/userProfile')
let about = require('./views/about')
let forgotPassword = require('./views/forgotPassword')
let logout = require('./views/logout')

module.exports = {
  '/': explore,
  '/u/:user': userProfile,
  '/u/:owner/:projectId': displayProject,
  '/u/:owner/:projectId/edit': editProject,
  // '/create': createProject,
  '/about': about,
  '/login': login,
  '/logout': logout,
  '/account/forgotpassword': forgotPassword,
  // '/discourse/sso': discourse.routeOptions,
}
