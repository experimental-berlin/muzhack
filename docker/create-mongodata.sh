#!/bin/sh
docker create -v /var/mongo:/data/db --name mongodata mongo
docker create -v /var/mongo.staging:/data/db --name mongodata.staging mongo
