#!/bin/sh
docker create -v /var/mongo:/data/db --name mongodata mongo
