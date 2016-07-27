FROM nodesource/jessie:6
MAINTAINER MuzHack Team <contact@muzhack.com>

WORKDIR /app
ENTRYPOINT ["node", "dist/app/server.js"]
ENV PORT=80
EXPOSE 80

# Cache dependencies in order to speed up builds
COPY package.json package.json
COPY requirements.txt requirements.txt
# Turn off production mode, as we need to install dev dependencies
ENV NODE_ENV=
RUN npm install
RUN npm install -g gulp
RUN pip install -U pip
RUN pip install -U -r requirements.txt

COPY ./ .
RUN ./node_modules/.bin/webpack -p --devtool cheap-module-source-map
RUN gulp
