FROM nodesource/jessie:5
MAINTAINER MuzHack Team <contact@muzhack.com>

WORKDIR /app
ENTRYPOINT ["node", "--harmony_destructuring", "dist/app/server.js"]
ENV PORT=80
EXPOSE 80

# Cache package.json to speed up builds
COPY package.json package.json
# Turn off production mode, as we need to install dev dependencies
ENV NODE_ENV=
RUN npm install
# Get rid of module version mismatches
RUN npm rebuild
RUN npm install -g gulp

COPY ./ .
RUN ./node_modules/.bin/webpack -d
RUN gulp
