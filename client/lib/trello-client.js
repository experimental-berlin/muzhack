(function() {
    "use strict";

    var token = null;
    var authCallbacks = [];
    var authEndpoint = "https://trello.com";

    function isFunction(obj) {
        return typeof obj === "function";
    }

    function setUpApi() {
        var windowLocation = window.location;
        window.Trello = {
            deauthorize: function() {
                token = null;
                delete localStorage.trelloToken;
            },
            authorize: function(appKey, opts) {
                opts = jQuery.extend(true, {
                    scope: {
                        read: true,
                        write: false,
                        account: false
                    },
                    expiration: "30days"
                }, opts);
                if (token == null) {
                  token = localStorage.trelloToken;
                }
                if (token != null) {
                    if (isFunction(opts.success)) {
                        opts.success(token);
                    }
                    return;
                }

                authCallbacks.push(opts);

                var scopeArray = Object.keys(opts.scope).filter(function (k) {
                    return opts.scope[k];
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
                        scope: scopeArray.join(","),
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
                if (token != null) {
                    localStorage.trelloToken = token;
                }
                var authCallback;
                while (authCallbacks.length > 0) {
                    authCallback = authCallbacks.shift();
                    if (token != null) {
                        if (isFunction(authCallback.success)) {
                            authCallback.success(token);
                        }
                    } else {
                        if (isFunction(authCallback.error)) {
                            authCallback.error();
                        }
                    }
                }
            }
        }
        window.addEventListener("message", handleMessage, false);
    }

    setUpApi();
})();
