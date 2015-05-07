#!/bin/bash
docker run --name mongo.staging -d -p 27018:27017 --volumes-from mongodata.staging --restart always mongo:3.0.2 --auth
docker run --name muzhack.staging -d --restart always --env-file staging.env --link mongo.staging:db aknudsen/muzhack
