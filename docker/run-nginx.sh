#!/bin/bash
docker run -d --restart always --name nginx -v /etc/nginx/ssl/bundle.crt:/bundle.crt -v /etc/nginx/ssl/private.key:/private.key --link muzhack.staging:backend.staging --link muzhack:backend -p 443:443 -p 80:80 aknudsen/meteor-frontend-server /start.sh
