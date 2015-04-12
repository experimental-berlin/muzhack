#!/bin/bash
docker run --name muzhack.staging -d --restart=always --env-file=staging.env --link mongo:db -p 80:80 aknudsen/muzhack
