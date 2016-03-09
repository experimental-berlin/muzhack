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
    let errors = this.validators.map((fn) => {
      return this.input instanceof Array ? fn(...this.input) : fn(this.input)
    })
    return R.any(v => v, errors)
  }
}

class InvalidUsername extends ValidationError {
  constructor(input) {
    super(
      input,
      [Fns.isEmptyOrHasSpace, Fns.hasSpecialChars,],
      'Invalid username, please use only a-z, A-Z ,_.'
    )
  }
}

class InvalidPassword extends ValidationError {
  constructor(input) {
    super(
      input,
      [Fns.isEmptyOrHasSpace,],
      'Invalid password, it cannot contain whitespace.'
    )
  }
}

class InvalidPasswordConfirm extends ValidationError {
  constructor(inputs) {
    super(
      inputs,
      [Fns.areNotTheSame,],
      'The passwords do not match'
    )
  }
}

module.exports = {
  ValidationError,
  InvalidUsername,
  InvalidPassword,
  InvalidPasswordConfirm,
}
