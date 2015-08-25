(function() {
    "use strict";

    var deferred, ready;
    var token = null;
    var appKey = null;
    var authEndpoint = "https://trello.com";

    function writeToken(value) {
        if (value == null) {
            delete localStorage.trello_token;
        } else {
            localStorage.trello_token = value;
        }
    }

    function isFunction(obj) {
        return typeof obj === "function";
    }

    function setIsReady() {
        var deferredCallbacks = deferred.authorized;
        var e;
        var isReady = token != null;
        ready.authorized = isReady;
        if (deferredCallbacks != null) {
            delete deferred.authorized;
            for (e = 0; e < deferredCallbacks.length; ++e) {
                deferredCallbacks[e](isReady);
            }
        }
    }

    function waitUntilAuthorized(f) {
        var key = "authorized";
        if (ready[key] != null) {
            f(ready[key]);
        } else {
            if (deferred[key] == null) {
                deferred[key] = [];
            }
            deferred[key].push(f);
        }
    }

    function setUpApi() {
        var windowLocation = window.location;
        window.Trello = {
            key: function() {
                return appKey;
            },
            setKey: function(k) {
                appKey = k;
            },
            token: function() {
                return token;
            },
            authorized: function() {
                return token != null;
            },
            deauthorize: function() {
                token = null;
                writeToken();
            },
            authorize: function(opts) {
                var k;
                opts = jQuery.extend(true, {
                    scope: {
                        read: true,
                        write: false,
                        account: false
                    },
                    expiration: "30days"
                }, opts);
                if (token == null) {
                  token = localStorage.trello_token;
                }
                if (token != null) {
                    if (isFunction(opts.success)) {
                        opts.success(token);
                    }
                    return;
                }

                var scopeArray = [];
                for (k in opts.scope) {
                    if (opts.scope[k]) {
                      scopeArray.push(k);
                    }
                }
                var scopeStr = scopeArray.join(",");
                waitUntilAuthorized(function (isReady) {
                    if (isReady) {
                        writeToken(token);
                        if (isFunction(opts.success)) {
                            opts.success(token);
                        }
                    } else {
                        if (isFunction(opts.error)) {
                            opts.error();
                        }
                    }
                });
                var leftCoordinate = window.screenX + (window.innerWidth - 420) / 2;
                var topCoordinate = window.screenY + (window.innerHeight - 470) / 2;
                var temp;
                var returnUrl = (temp = /^[a-z]+:\/\/[^\/]*/.exec(windowLocation)) != null ?
                    temp[0] : undefined;
                var authUrl = authEndpoint + "/1/authorize?" +
                    jQuery.param({
                        "return_url": returnUrl,
                        "callback_method": "postMessage",
                        scope: scopeStr,
                        expiration: opts.expiration,
                        name: opts.name,
                        "response_type": "token",
                        key: appKey
                    });
                window.open(authUrl, "trello", "width=420,height=470,left=" +
                  leftCoordinate + ",top=" + topCoordinate);
            }
        };

        function handleMessage(event) {
            if (event.origin === authEndpoint) {
                if (event.source != null) {
                    event.source.close();
                }
                token = event.data != null && event.data.length > 4 ? event.data : null;
                setIsReady();
            }
        }
        window.addEventListener("message", handleMessage, false);
    }
    deferred = {};
    ready = {};

    setUpApi();
})();
