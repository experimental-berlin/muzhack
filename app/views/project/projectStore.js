'use strict'
let h = require('react-hyperscript')
let component = require('omniscient')
let logger = require('js-logger-aknudsen').get('projectStore')
let R = require('ramda')
let {convertMarkdown,} = require('../../markdown')

if (__IS_BROWSER__) {
  require('./projectStore.styl')
}

module.exports = component('ProjectStore', ({storeItems,}) => {
  logger.debug(`Rendering project store items:`, storeItems)
  return h('#project-store', [
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
              h('button.pure-button', [
                h('.store-item-buy', `Buy`),
                h('.store-item-price', `$${item.price}`),
              ]),
              h('.store-item-stock', `${item.stock} in stock`),
            ]),
          ]),
        ]),
      ])
    }, storeItems)),
  ])
})
