'use strict'
let Fns = require('./validationFunctions')
let R = require('ramda')

class ValidationError {
  constructor(input, validators=[], errorText) {
    this.input = input
    this.validators = validators
    this._errorText = errorText
  }
  
  get errorText() {
    return this.isInvalid ? this._errorText : ''
  }

  get isInvalid() {
    let errors = this.validators.map((fn) => fn(this.input))
    let anyError = R.any(v => v, errors)
    console.log(`IS THIS INVALID? ${anyError} ${errors}`);

    return anyError
  }
}

class InvalidUsernameError extends ValidationError {
  constructor(input) {
    super(
      input, 
      [Fns.isEmptyOrHasSpace, Fns.hasSpecialChars,], 
      'Invalid username, please use only a-z, A-Z ,_.'
    )
  }
}

module.exports = {
  ValidationError,
  InvalidUsernameError,
}
