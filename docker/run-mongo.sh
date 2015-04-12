#!/bin/bash
docker run --name mongo -d -p 27017:27017 --volumes-from mongodata --restart=always mongo:3.0.2 --auth
