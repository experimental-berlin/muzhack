FROM nodesource/jessie:5
MAINTAINER Arve Knudsen

WORKDIR /app
ENTRYPOINT ["node", "."]
ENV PORT=80

# Cache package.json and node_modules to speed up builds
COPY package.json package.json
# Turn off production mode, as we need to install dev dependencies
ENV NODE_ENV=
RUN npm install

COPY ./ .
RUN ./node_modules/.bin/webpack
