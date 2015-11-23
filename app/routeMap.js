'use strict'
let explore = require('./views/explore')
let displayProject = require('./views/project/displayProject')
let login = require('./views/login')
let userProfile = require('./views/userProfile/userProfile')
let about = require('./views/about')
let forgotPassword = require('./views/forgotPassword')

module.exports = {
  '/': explore,
  '/u/:user': userProfile,
  '/u/:owner/:projectId': displayProject,
  // '/u/:owner/:projectId/edit': editProject.routeOptions,
  // '/create': createProject.routeOptions,
  '/about': about,
  '/login': login,
  // '/logout': logout.render,
  '/account/forgotpassword': forgotPassword,
  // '/discourse/sso': discourse.routeOptions,
}
