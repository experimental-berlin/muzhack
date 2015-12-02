MuzHack
===========

[![Gitter](https://badges.gitter.im/Join%20Chat.svg)](https://gitter.im/muzhack/muzhack?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge)
[![Docker Repository on Quay.io](https://quay.io/repository/aknuds1/muzhack/status "Docker Repository on Quay.io")](https://quay.io/repository/aknuds1/muzhack)

[MuzHack](https://muzhack.com) is a Web application for publishing musical instrument designs.

[![Support via Gratipay](https://cdn.rawgit.com/gratipay/gratipay-badge/2.x.x/dist/gratipay.svg)](https://gratipay.com/~Arve Knudsen/)
[![Flattr this git repo](http://api.flattr.com/button/flattr-badge-large.png)](https://flattr.com/submit/auto?user_id=muzhack&url=http://github.com/muzhack/muzhack&title=MuzHack&tags=github&category=software)

# Editing
Please install [EditorConfig](http://editorconfig.org/) in your editor of choice, since we control the code standard through that (e.g. 2 spaces indentation). Specifically the EditorConfig settings are defined in the *.editorconfig* file.

Please also install [ESLint](http://eslint.org/) in your editor, in order to make sure you conform to our code standards. This is configured via *.eslintrc*.

# Development
MuzHack is developed with Node (via [hapi.js](http://hapijs.com/)) on the server and [Omniscient](http://omniscientjs.github.io/) (a functional, top-down rendering, [React](https://facebook.github.io/react/) wrapper). The code standard is ES2015 JavaScript. We use Babel to be able to write ES2015 both on the server and on the client.

For the database we use [RethinkDB](https://www.rethinkdb.com/), a NoSQL technology.

## Local Installation
1. Enter the MuzHack Git repository.
2. Install [nvm](https://github.com/creationix/nvm).
3. `nvm install`.
4. `npm install`.
5. [Install RethinkDB](http://rethinkdb.com/docs/install/).
6. `./rethinkdb/setup-rethinkdb.py $AUTH_KEY`.

## Running Locally
1. In one terminal, enter the MuzHack repository.
2. Run the Node server: `./run-server.sh`
3. In another terminal, enter the MuzHack repository.
4. Run the Webpack dev server: `./node_modules/.bin/webpack-dev-server -d --inline`. This serves as a front-end to the Node server, which automatically compiles resources via Webpack.
5. Access the Webpack dev server at http://localhost:8080 in your browser. The app will automatically be refreshed when you make changes to the source code thanks to Webpack's hot reload feature.
