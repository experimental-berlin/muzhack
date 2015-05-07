#!/bin/bash
docker run --name mongo -d -p 27017:27017 --volumes-from mongodata --restart always --rm mongo:3.0.2 --auth
docker run --name muzhack -d --restart always --env-file production.env --link mongo:db --rm aknudsen/muzhack
