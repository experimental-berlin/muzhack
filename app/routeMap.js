'use strict'
let explore = require('./views/explore')
let displayProject = require('./views/project/displayProject')
let editProject = require('./views/project/editProject')
let createProject = require('./views/project/createProject')
let login = require('./views/login')
let userProfile = require('./views/userProfile/userProfile')
let about = require('./views/about')
let forgotPassword = require('./views/forgotPassword')
let resetPassword = require('./views/resetPassword')
let logout = require('./views/logout')
let discourse = require('./discourse')

module.exports = {
  '/': explore,
  '/u/:user': userProfile,
  '/u/:owner/:projectId': displayProject,
  '/u/:owner/:projectId/edit': editProject,
  '/create': createProject,
  '/about': about,
  '/login': login,
  '/logout': logout,
  '/account/forgotpassword': forgotPassword,
  '/account/resetpassword/:token': resetPassword,
  '/discourse/sso': discourse,
}
