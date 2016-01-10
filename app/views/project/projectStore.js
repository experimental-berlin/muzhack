'use strict'
let h = require('react-hyperscript')
let component = require('omniscient')
let logger = require('js-logger-aknudsen').get('projectStore')
let R = require('ramda')

let {convertMarkdown,} = require('../../markdown')
let Modal = require('../modal')
let FocusingInput = require('../focusingInput')
let ajax = require('../../ajax')

if (__IS_BROWSER__) {
  require('./projectStore.styl')
}

let CheckoutButton = component('CheckoutButton', ({project, cursor, item,}) => {
  let disableSubmit = cursor.cursor('checkoutDialog').get('disableSubmit')
  logger.debug(`Rendering Checkout button - disabled: ${disableSubmit}`)
  return h('input#checkout-button.pure-button.pure-button-primary', {
    disabled: disableSubmit ? 'disabled' : '',
    type: 'submit',
    value: `Pay $${item.price}`,
    onClick: (event) => {
      event.preventDefault()
      logger.debug(`Checkout button clicked`)
      let state = cursor.cursor('checkoutDialog').toJS()
      logger.debug(`State of checkout dialog:`, state)
      cursor.cursor('checkoutDialog').set('disableSubmit', true)
      logger.debug(`Requesting token from Stripe...`)
      new Promise((resolve, reject) => {
        Stripe.card.createToken({
          number: state.cardNumber,
          cvc: state.cvc,
          exp_month: state.expirationMonth,
          exp_year: state.expirationYear,
        }, (status, response) => {
          logger.debug(`Received response from Stripe:`, response)
          if (response.error != null) {
            logger.debug(`Received an error from Stripe: '${response.error.message}'`)
            reject(`Stripe error: '${response.error.message}'`)
            // TODO
          } else {
            let token = response.id
            logger.debug(`Received Stripe token: '${token}'`)
            ajax.postJson('/api/stripe/checkout', {
              token,
              // TODO
              currency: 'usd',
              description: `1 ${project.title} - ${item.title}`,
              amount: token.price,
            })
              .then(() => {
                cursor.cursor('projectStore').set('checkingOutItem', null)
                resolve()
              }, reject)
          }
        })
      })
        .then(() => {
          cursor.cursor('checkoutDialog').set('disableSubmit', false)
        }, () => {
          cursor.cursor('checkoutDialog').set('disableSubmit', false)
        })
    },
  })
})

let CheckoutDialog = component('CheckoutDialog', ({project, item, cursor,}) => {
  let onInputChange = (property, event) => {
    let value = event.target.value
    logger.debug(`Setting property ${property}: ${value}`)
    cursor.cursor('checkoutDialog').set(property, value)
  }

  logger.debug(`Rendering checkout dialog for ${project.title} - ${item.title}`, project)
  return Modal({
    title: 'Checkout',
    content: h('div', [
      h('.modal-body-content', [
        h('#checkout-header', [
          h('#checkout-project-title', project.title),
          h('#checkout-item-title', item.title),
        ]),
        h('#checkout-body', [
          h('form.pure-form.pure-form-stacked', {action: '',}, [
            h('fieldset', [
              h('legend', 'Payment Info'),
              FocusingInput({
                id: 'card-number',
                classes: ['modal-input',],
                placeholder: 'Card number',
                required: true,
                onChange: (event) => {
                  if (!Stripe.card.validateCardNumber(event.target.value)) {
                    logger.warn(`Failed to validate card number`)
                    // TODO
                  }
                  onInputChange('cardNumber', event)
                },
              }),
              h('input.modal-input', {
                placeholder: 'CVC',
                required: true,
                onChange: (event) => {
                  if (!Stripe.card.validateCVC(event.target.value)) {
                    logger.warn(`Failed to validate CVC`)
                    // TODO
                  }
                 onInputChange('cvc', event)
                },
              }),
              h('input.modal-input', {
                placeholder: 'Expiration month (MM)',
                required: true,
                onChange: (event) => {
                  onInputChange('expirationMonth', event)
                  let checkoutState = cursor.cursor('checkoutDialog').toJS()
                  if (!Stripe.card.validateExpiry(checkoutState.expirationMonth,
                      checkoutState.expirationYear)) {
                    logger.warn(`Failed to validate card expiration`)
                    // TODO
                  }
                },
              }),
              h('input.modal-input', {
                placeholder: 'Expiration year (YY)',
                required: true,
                onChange: (event) => {
                  onInputChange('expirationYear', event)
                  let checkoutState = cursor.cursor('checkoutDialog').toJS()
                  if (!Stripe.card.validateExpiry(checkoutState.expirationMonth,
                      checkoutState.expirationYear)) {
                    logger.warn(`Failed to validate card expiration`)
                    // TODO
                  }
                },
              }),
              CheckoutButton({project, item, cursor,}),
            ]),
          ]),
        ]),
      ]),
    ]),
    closeCallback: () => {
      cursor.cursor('projectStore').set('checkingOutItem', null)
    },
  })
})

let BuyButton = component('BuyButton', ({item, cursor,}) => {
  logger.debug(`Rendering buy button`)
  return h('button#buy-button.pure-button', {
    onClick: () => {
      logger.debug(`Buy button clicked`)
      cursor.cursor('projectStore').set('checkingOutItem', item)
    },
  }, [
    h('.store-item-buy', `Buy`),
    h('.store-item-price', `$${item.price}`),
  ])
})

module.exports = component('ProjectStore', ({project, storeItems, cursor,}) => {
  logger.debug(`Rendering project store items:`, storeItems)
  let checkingOut = cursor.cursor('projectStore').get('checkingOutItem')
  return h('div', [
    checkingOut != null ? CheckoutDialog({
      project,
      item: checkingOut,
      cursor,
    }) : null,
    h('#project-store', [
      h('ul.store-item-list', R.map((item) => {
        logger.debug(`Rendering store item:`, item)
        return h('li', [
          h('.store-item', [
            h('img.store-item-image', {'src': item.image,}),
            h('.store-item-contents', [
              h('.store-item-contents-left', [
                h('.store-item-title', item.title),
                h('.store-item-description', [
                  convertMarkdown(item.description),
                ]),
              ]),
              h('.store-item-contents-right', [
                BuyButton({item, cursor,}),
                h('.store-item-stock', `${item.stock} in stock`),
              ]),
            ]),
          ]),
        ])
      }, storeItems)),
    ]),
  ])
})
