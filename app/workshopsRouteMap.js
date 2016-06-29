'use strict'
let workshopsExplore = require('./views/workshopsExplore')
let login = require('./views/login')
let workshopsUserProfile = require('./views/workshopsUserProfile/workshopsUserProfile')
let workshopsAbout = require('./views/workshopsAbout')
let forgotPassword = require('./views/forgotPassword')
let resetPassword = require('./views/resetPassword')
let logout = require('./views/logout')

module.exports = {
  '/': workshopsExplore,
  '/about': workshopsAbout,
  '/login': login,
  '/logout': logout,
  '/u/:user': workshopsUserProfile,
  '/account/forgotpassword': forgotPassword,
  '/account/resetpassword/:token': resetPassword,
}
