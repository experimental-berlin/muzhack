FROM node:0.10.38
MAINTAINER Arve Knudsen

RUN apt-get update -y && apt-get install -y curl

# Install PhantomJS
RUN apt-get install libfreetype6 libfreetype6-dev fontconfig

RUN apt-get clean && rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*

ENV PORT 80
EXPOSE 80
ENTRYPOINT ["node", "main.js"]

ENV PHANTOM_JS="phantomjs-1.9.8-linux-x86_64"
WORKDIR /usr/local/share
RUN curl https://s3.amazonaws.com/arve-various/$PHANTOM_JS.tar.bz2 | tar xvj
RUN ln -sf /usr/local/share/$PHANTOM_JS/bin/phantomjs /usr/local/bin

# Build bundle
RUN curl https://install.meteor.com | /bin/sh

COPY ./ /app
WORKDIR /app
RUN meteor build --directory /tmp/the-app
WORKDIR /tmp/the-app/bundle/programs/server/
RUN npm install
RUN mv /tmp/the-app/bundle /built_app
WORKDIR /built_app

# cleanup
RUN rm -rf /tmp/the-app ~/.meteor /usr/local/bin/meteor
