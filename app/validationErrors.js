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
      [Fns.isBlankOrHasSpace, Fns.hasSpecialChars,],
      'Invalid username, please use only a-z, A-Z ,_.'
    )
  }
}

class InvalidPassword extends ValidationError {
  constructor(input) {
    super(
      input,
      [Fns.isBlankOrHasSpace,],
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

class InvalidEmail extends ValidationError {
  constructor(input) {
    super(input, [Fns.isBlank,], 'Invalid email')
  }
}

class InvalidName extends ValidationError {
  constructor(input) {
    super(input, [Fns.isBlank,], 'Invalid name')
  }
}

class InvalidWebsite extends ValidationError {
  constructor(input) {
    super(input, [Fns.isBlank,], 'Invalid website')
  }
}

module.exports = {
  ValidationError,
  InvalidUsername,
  InvalidPassword,
  InvalidPasswordConfirm,
  InvalidEmail,
  InvalidName,
  InvalidWebsite,
}
