'use strict'
let logger = require('js-logger').get('editing')

module.exports.onChange = () => {
  logger.debug('Project has changed - setting dirty state')
  // Session.set('isProjectModified', true)
}
