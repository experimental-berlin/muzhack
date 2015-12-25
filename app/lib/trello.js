'use strict'
let $ = require('jquery')

let opts = {
    'version': 1,
    'apiEndpoint': 'https://api.trello.com',
    'authEndpoint': 'https://trello.com',
    'intentEndpoint': 'https://trello.com',
};

let slice = [].slice;

let wrapper = function() {
  let m, x, z, A, p, l, t, q, B, y, g, v, w;
  l = opts.key;
  g = opts.token;
  e = opts.apiEndpoint;
  m = opts.authEndpoint;
  A = opts.intentEndpoint;
  v = opts.version;
  z = e + '/' + v + '/';
  q = window.location;
  let h = {
    version: function() {
      return v
    },
    key: function() {
      return l
    },
    setKey: function(b) {
      l = b
    },
    token: function() {
      return g
    },
    setToken: function(b) {
      g = b
    },
    rest: function() {
      let b, a, r, d;
      a = arguments[0];
      b = 2 <= arguments.length ? slice.call(arguments, 1) : [];
      d = B(b);
      r = d[0];
      b = d[1];
      let c = {
        url: '' + z + r,
        type: a,
        data: {},
        dataType: 'json',
        success: d[2],
        error: d[3],
      };
      $.support.cors ||
      (opts.dataType = 'jsonp', 'GET' !== a && (opts.type = 'GET', $.extend(opts.data, {
        _method: a,
      })));
      l && (opts.data.key = l);
      g && (opts.data.token = g);
      null != b && $.extend(opts.data, b);
      return $.ajax(c)
    },
    authorized: function() {
      return null != g
    },
    deauthorize: function() {
      g = null;
      w('token', g)
    },
    authorize: function(b) {
      let k, r, d, e, h;
      let c = $.extend(!0, {
        type: 'redirect',
        persist: !0,
        interactive: !0,
        scope: {
          read: !0,
          write: !1,
          account: !1,
        },
        expiration: '30days',
      }, b);
      b = /[&#]?token=([0-9a-f]{64})/;
      r = function() {
        if (opts.persist && null != g) return w('token', g)
      };
      opts.persist && null == g &&
      (g = y('token'));
      null == g && (g = null != (d = b.exec(q.hash)) ? d[1] : void 0);
      if (this.authorized()) {
        return r(), q.hash = q.hash.replace(b, ''), 'function' ===
        typeof opts.success ? opts.success() : void 0;
      }
      if (!opts.interactive) {
        return 'function' === typeof opts.error ? opts.error() : void 0;
      }
      e = function() {
        let b, a;
        b = opts.scope;
        a = [];
        for (k in b)(h = b[k]) && a.push(k);
        return a
      }().join(',');
      switch (opts.type) {
        case 'popup':
        (function() {
          let b, k, d, f;
          waitUntil('authorized', function(b) {
            return function(b) {
              return b ? (r(), 'function' === typeof opts.success ? opts.success() : void 0) :
              'function' === typeof opts.error ? opts.error() : void 0
            }
          }(this));
          b = window.screenX + (window.innerWidth - 420) / 2;
          f = window.screenY + (window.innerHeight - 470) / 2;
          k = null != (d = /^[a-z]+:\/\/[^\/]*/.exec(q)) ? d[0] : void 0;
          return window.open(x({
            return_url: k,
            callback_method: 'postMessage',
            scope: e,
            expiration: opts.expiration,
            name: opts.name,
          }), 'trello', 'width=420,height=470,left=' + b + ',top=' + f)
        })();
        break;
        default:
        window.location = x({
          redirect_uri: q.href,
          callback_method: 'fragment',
          scope: e,
          expiration: opts.expiration,
          name: opts.name,
        })
      }
    },
    addCard: function(b, c) {
      let e, d;
      e = {
        mode: 'popup',
        source: l || window.location.host,
      };
      d = function(c) {
        let d, k, g;
        k = function(b) {
          let d;
          window.removeEventListener('message', k);
          try {
            return d = JSON.parse(b.data), d.success ? c(null, d.card) : c(Error(d.error))
          } catch (e) {}
        };
        'function' === typeof window.addEventListener && window.addEventListener('message', k, !1);
        d = window.screenX + (window.outerWidth - 500) / 2;
        g = window.screenY + (window.outerHeight - 600) / 2;
        return window.open(A + '/add-card?' + $.param($.extend(e, b)), 'trello', 'width=500,height=600,left=' + d + ',top=' + g)
      };
      return null != c ? d(c) : window.Promise ? new Promise(function(b, a) {
        return d(function(c, d) {
          return c ? a(c) : b(d)
        })}) : d(function() {})
    },
  };

  let s = ['GET', 'PUT', 'POST', 'DELETE',];
  let e = function(b) {
    return h[b.toLowerCase()] = function() {
      return this.rest.apply(this, [b,].concat(slice.call(arguments)))
    }
  };
  n = 0;
  for (p = s.length; n < p; n++) u = s[n], e(u);
  h.del = h['delete'];
  let u = 'actions cards checklists boards lists members organizations lists'.split(' ');
  let n = function(b) {
    return h[b] = {
      get: function(a, c, d, e) {
        return h.get(b + '/' + a, c, d, e)
      },
    }
  };
  p = 0;
  for (s = u.length; p < s; p++) e = u[p], n(e);
  x = function(b) {
    return m + '/' + v + '/authorize?' +
    $.param($.extend({
      response_type: 'token',
      key: l,
    }, b))
  };
  B = function(b) {
    let a, c, d;
    c = b[0];
    a = b[1];
    d = b[2];
    b = b[3];
    isFunction(a) && (b = d, d = a, a = {});
    c = opts.replace(/^\/*/, '');
    return [c, a, d, b,]
  };
  e = function(b) {
    let a;
    b.origin === m && (null != (a = b.source) && window.close(), g = null != b.data && 4 < b.data.length ? b.data : null, isReady('authorized', h.authorized()))
  };
  t = window.localStorage;
  null != t ? (y = function(b) {
    return t['trello_' + b]
  }, w = function(b, a) {
    return null === a ? delete t['trello_' + b] : t['trello_' + b] = a
  }) : y = w = function() {};
  'function' === typeof window.addEventListener &&
  window.addEventListener('message', e, !1)

  return h;
};

let deferred = {};
let ready = {};

let waitUntil = function(a, f) {
  return null != ready[a] ? f(ready[a]) : (null != deferred[a] ? deferred[a] : deferred[a] = []).push(f)
};

let isReady = function(a, f) {
  let c, h, e, m;
  ready[a] = f;
  if (deferred[a]) {
    for (h = deferred[a], delete deferred[a], e = 0, m = h.length; e < m; e++) c = h[e], c(f)
  }
};

let isFunction = function(a) {
  return 'function' === typeof a
};

module.exports = wrapper()
