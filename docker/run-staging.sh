#!/bin/bash
docker run --name mongo.staging -d -p 27017:27017 --volumes-from mongodata --restart always mongo:3.0.2 --auth
docker run --name muzhack.staging -d --restart always --env-file staging.env --link mongo.staging:db aknudsen/muzhack
docker run -d --restart always --name nginx.staging -v /etc/nginx/ssl/bundle.crt:/bundle.crt -v /etc/nginx/ssl/private.key:/private.key --link muzhack.staging:backend --publish 443:443 meteorhacks/mup-frontend-server /start.sh
