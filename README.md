MuzHack
===========

[![Gitter](https://badges.gitter.im/Join%20Chat.svg)](https://gitter.im/muzhack/muzhack?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge)
[![Stories in Ready](https://badge.waffle.io/muzhack/muzhack.png?label=ready&title=Ready)](https://waffle.io/muzhack/muzhack)
[![Docker Repository on Quay.io](https://quay.io/repository/aknuds1/muzhack/status "Docker Repository on Quay.io")](https://quay.io/repository/aknuds1/muzhack)
[![Circle CI](https://circleci.com/gh/muzhack/muzhack.svg?style=svg)](https://circleci.com/gh/muzhack/muzhack)

[MuzHack](https://muzhack.com) is a Web application for publishing musical instrument designs.

[![Support via Gratipay](https://cdn.rawgit.com/gratipay/gratipay-badge/2.x.x/dist/gratipay.svg)](https://gratipay.com/~Arve Knudsen/)
[![Flattr this git repo](http://api.flattr.com/button/flattr-badge-large.png)](https://flattr.com/submit/auto?user_id=muzhack&url=http://github.com/muzhack/muzhack&title=MuzHack&tags=github&category=software)

## Editing
Please install [EditorConfig](http://editorconfig.org/) in your editor of choice, since we control the code standard through that (e.g. 2 spaces indentation). Specifically the EditorConfig settings are defined in the *.editorconfig* file.

Please also install [ESLint](http://eslint.org/) in your editor, in order to make sure you conform to our code standards. This is configured via *.eslintrc*.

## Development
MuzHack is developed with Node (via [hapi.js](http://hapijs.com/)) on the server and [Omniscient](http://omniscientjs.github.io/) (a functional, top-down rendering, [React](https://facebook.github.io/react/) wrapper). The code standard is ES2015 JavaScript. We use Babel to be able to write ES2015 both on the server and on the client.

For the database we use [RethinkDB](https://www.rethinkdb.com/), a NoSQL technology.

### Local Installation
1. Enter the MuzHack Git repository.
2. Get Git submodules: `git submodule update --init --recursive`
3. Install [nvm](https://github.com/creationix/nvm).
4. `nvm install`.
5. `npm install`.
6. If you don't have Python 3 already, install it with brew: `brew install python3`.
7. `pip3 install -r requirements.txt`
8. [Install RethinkDB](http://rethinkdb.com/docs/install/).
9. `./rethinkdb/setup-rethinkdb.py`.

### Running Locally
1. In one terminal, enter the MuzHack repository.
2. Run the Node server: `./run-server`
3. In another terminal, enter the MuzHack repository.
4. Run the Webpack dev server: `./node_modules/.bin/webpack-dev-server -d --inline`. This serves as a front-end to the Node server, which automatically compiles resources via Webpack.
5. Access the Webpack dev server at http://localhost:8080 in your browser. The app will automatically be refreshed when you make changes to the source code thanks to Webpack's hot reload feature.

### Deployment
MuzHack is deployed as a set of Docker containers to [Google Container Engine](https://cloud.google.com/container-engine).
