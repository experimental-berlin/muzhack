FROM node:0.10.36
MAINTAINER Arve Knudsen

RUN apt-get update -y && apt-get install -y curl wget

# Install PhantomJS
RUN apt-get install libfreetype6 libfreetype6-dev fontconfig
ENV PHANTOM_JS="phantomjs-1.9.8-linux-x86_64"
WORKDIR /usr/local/share
RUN wget https://bitbucket.org/ariya/phantomjs/downloads/$PHANTOM_JS.tar.bz2
RUN tar xvjf $PHANTOM_JS.tar.bz2
RUN rm $PHANTOM_JS.tar.bz2
RUN ln -sf /usr/local/share/$PHANTOM_JS/bin/phantomjs /usr/local/bin

# Build bundle
RUN curl https://install.meteor.com | /bin/sh
COPY ./ /app
WORKDIR /app
RUN meteor build --directory /tmp/the-app
WORKDIR /tmp/the-app/bundle/programs/server/
RUN npm i
RUN mv /tmp/the-app/bundle /built_app

# cleanup
RUN rm -rf /tmp/the-app
RUN rm -rf ~/.meteor
RUN rm /usr/local/bin/meteor
RUN apt-get clean && rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*

EXPOSE 80
ENTRYPOINT [node, main.js]
