FROM nodesource/jessie:5
MAINTAINER Arve Knudsen

WORKDIR /app
ENTRYPOINT ["node", "."]

# Cache package.json and node_modules to speed up builds
COPY package.json package.json
RUN npm install

COPY ./ .
RUN pwd
RUN ls
RUN ls ./node_modules/.bin
RUN ./node_modules/.bin/webpack
