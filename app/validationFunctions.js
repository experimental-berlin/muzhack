'use strict'
let logger = require('js-logger-aknudsen').get('validationFunctions')
let R = require('ramda')
let S = require('underscore.string.fp')

module.exports = {
  isBlank: S.isBlank,
  isBlankOrHasSpace: (input) => {
    let isBlank = S.isBlank(input)
    if (isBlank) {
      logger.debug(`Input is blank: '${input}'`)
    }
    let hasSpace = input.indexOf(' ') > -1
    if (hasSpace) {
      logger.debug(`Input has space: '${input}'`)
    }
    return (isBlank || hasSpace)
  },
  hasSpecialChars: (input) => {
    let val = R.toLower(input)
    logger.debug(`Checking '${input}' for special chars`)
    let match = R.match(/[a-z_]/gi, input)
    logger.debug(`Match:`, match)
    return match.length !== input.length
  },
  areNotTheSame: (inputA, inputB) => {
    return inputA !== inputB
  },
}
