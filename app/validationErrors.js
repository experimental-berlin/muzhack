'use strict'
let logger = require('js-logger-aknudsen').get('validationFunctions')
let Fns = require('./validationFunctions')
let R = require('ramda')

class ValidationError {
  constructor(name, input, validators=[], errorText) {
    this.name = name
    this.input = input
    if (!R.isArrayLike(validators)) {
      validators = [validators,]
    }
    this.validators = validators
    this._errorText = errorText
  }

  get errorText() {
    return this.isInvalid ? this._errorText : ''
  }

  get isInvalid() {
    let errors = R.map((fn) => {
      logger.debug(`${this.name}: Checking whether invalid, input(s):`, this.input)
      let result = this.input instanceof Array ? fn(...this.input) : fn(this.input)
      if (result) {
        logger.debug(`Invalid`)
      } else {
        logger.debug(`Valid`)
      }
      return result
    }, this.validators)
    return R.any(v => v, errors)
  }
}

class InvalidUsername extends ValidationError {
  constructor(input) {
    super(
      'InvalidUsername',
      input,
      (input) => {
        return /^[a-z_\-0-9]+$/.test(input)
      },
      'Invalid username, please use only a-z, 0-9, _, -.'
    )
  }
}

class InvalidPassword extends ValidationError {
  constructor(input) {
    super(
      'InvalidPassword',
      input,
      [Fns.isBlankOrHasSpace,],
      'Invalid password, it cannot contain whitespace.'
    )
  }
}

class InvalidPasswordConfirm extends ValidationError {
  constructor(inputs) {
    super(
      'InvalidPasswordConfirm',
      inputs,
      [Fns.areNotTheSame,],
      'The passwords do not match'
    )
  }
}

class InvalidEmail extends ValidationError {
  constructor(input) {
    super('InvalidEmail', input, [Fns.isBlank,], 'Invalid email')
  }
}

class InvalidName extends ValidationError {
  constructor(input) {
    super('InvalidName', input, [Fns.isBlank,], 'Invalid name')
  }
}

class InvalidWebsite extends ValidationError {
  constructor(input) {
    super('InvalidWebsite', input, [Fns.isBlank,], 'Invalid website')
  }
}

class InvalidProjectId extends ValidationError {
  constructor(input) {
    super(
      'InvalidProjectId',
      input,
      (input) => {
        return !/^[a-z_\-0-9]+$/.test(input)
      },
      'Invalid project ID, please use only a-z, 0-9, _, -.'
    )
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
  InvalidProjectId,
}
