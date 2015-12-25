'use strict';
let R = require('ramda')
let $ = require('jquery')
let logger = require('js-logger-aknudsen').get('trello')

let token = null;
let authPromises = [];
let authEndpoint = 'https://trello.com';
let windowLocation = window.location;

function isFunction(obj) {
  return typeof obj === 'function';
}

module.exports = {
  deauthorize: function () {
    token = null;
    delete localStorage.trelloToken;
  },
  authorize: function (appKey, opts) {
    opts = R.merge({
      scope: {
        read: true,
        write: false,
        account: false,
      },
      expiration: '30days',
    }, opts);
    if (token == null) {
      token = localStorage.trelloToken;
    }
    return new Promise((resolve, reject) => {
      if (token != null) {
        logger.debug(`Token is already defined`)
        resolve(token)
      } else {
        logger.debug(`Getting token from Trello server...`)
        logger.debug(`Options:`, opts)
        authPromises.push({resolve, reject,});

        let scopeArray = Object.keys(opts.scope).filter(function (k) {
          return opts.scope[k];
        });
        let leftCoordinate = window.screenX + (window.innerWidth - 420) / 2;
        let topCoordinate = window.screenY + (window.innerHeight - 470) / 2;
        let temp;
        let returnUrl = (temp = /^[a-z]+:\/\/[^\/]*/.exec(windowLocation)) != null ?
        temp[0] : undefined;
        let authUrl = authEndpoint + '/1/authorize?' + $.param({
          'return_url': returnUrl,
          'callback_method': 'postMessage',
          scope: scopeArray.join(','),
          expiration: opts.expiration,
          name: opts.name,
          'response_type': 'token',
          key: appKey,
        });
        window.open(authUrl, 'trello', 'width=420,height=470,left=' + leftCoordinate +
          ',top=' + topCoordinate);
      }
    })
  },
};

function handleMessage (event) {
  if (event.origin === authEndpoint) {
    logger.debug(`Received authorization message`)
    if (event.source != null) {
      event.source.close();
    }
    token = event.data != null && event.data.length > 4 ? event.data : null;
    if (token != null) {
      logger.debug(`Storing token to localStorage`)
      localStorage.trelloToken = token;
    }
    R.forEach((authPromise) => {
      if (token != null) {
        logger.debug(`Resolving promise with token`)
        authPromise.resolve(token);
      } else {
        logger.debug(`Rejecting promise`)
        authPromise.reject();
      }
    }, authPromises)
    authPromises = []
  }
}

window.addEventListener('message', handleMessage, false);
