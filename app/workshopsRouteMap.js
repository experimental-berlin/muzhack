'use strict'
let workshopsExplore = require('./views/workshopsExplore')
let login = require('./views/login')
let workshopsUserProfile = require('./views/workshops/workshopsUserProfile')
let workshopView = require('./views/workshops/workshopView')
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
  '/u/:user/:workshop': workshopView,
  '/account/forgotpassword': forgotPassword,
  '/account/resetpassword/:token': resetPassword,
}
