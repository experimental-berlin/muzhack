FROM nodesource/jessie:5
MAINTAINER Arve Knudsen

ENV PORT 80
EXPOSE 80
ENTRYPOINT ["node", "main.js"]

# Cache package.json and node_modules to speed up builds
COPY package.json package.json
RUN npm install

COPY ./ .
