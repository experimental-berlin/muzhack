'use strict'
let R = require('ramda')

module.exports = {
  isEmpty: R.isEmpty,
  isEmptyOrHasSpace: (input) => {
    let isEmpty = R.isEmpty(input)
    let hasSpace = input.indexOf(' ') > -1
    return (isEmpty || hasSpace)
  },
  hasSpecialChars: (input) => {
    let val = R.toLower(input)
    return R.match(/[a-z_]/g, val).length !== val.length
  },
  areNotTheSame: (inputA, inputB) => {
    return inputA !== inputB
  },
}
