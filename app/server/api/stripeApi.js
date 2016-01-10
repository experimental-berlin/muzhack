'use strict'
let logger = require('js-logger-aknudsen').get('stripeApi')
let stripe = require('stripe')('sk_test_up9Z8wz3kmysPcOPXza4Y2tV')
let Boom = require('boom')

let stripeCheckout = (request, reply) => {
  logger.debug(`Handling Stripe checkout request`)
  let {token, amount, currency, description, cvc,} = request.payload
  new Promise((resolve, reject) => {
    stripe.charges.create({
      amount,
      currency,
      source: token,
      description,
      cvc,
    }, function(err, charge) {
      logger.debug(`Stripe responded to charge request - error:`, err)
      if (err != null) {
        logger.warn(`Failed to charge via Stripe:`, err)
        reject(`Failed to charge via Stripe: ${err}`)
      } else {
        logger.debug(`Successfully charged via Stripe`)
        resolve()
      }
    })
  })
    .then(() => {
      logger.debug(`Replying with success`)
      reply()
    }, () => {
      logger.debug(`Replying with error`)
      reply(Boom.badRequest())
    })
}

module.exports = {
  stripeCheckout,
}
