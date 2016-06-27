'use strict'
let explore = require('./views/workshopsExplore')
let login = require('./views/login')
let userProfile = require('./views/userProfile/userProfile')
let about = require('./views/workshopsAbout')
let forgotPassword = require('./views/forgotPassword')
let resetPassword = require('./views/resetPassword')
let logout = require('./views/logout')

module.exports = {
  '/': explore,
  '/about': about,
  '/login': login,
  '/logout': logout,
  '/account/forgotpassword': forgotPassword,
  '/account/resetpassword/:token': resetPassword,
}
