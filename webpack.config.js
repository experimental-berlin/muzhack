'use strict'
module.exports = {
  context: __dirname + '/app',
  entry: './entry.js',
  output: {
    path: __dirname + '/dist',
    filename: 'bundle.js',
  },
  module: {
    loaders: [
      {
        test: /\.js$/,
        exclude: /(node_modules)/,
        loader: 'babel',
      },
    ],
  },
  debug: true,
  devtool: 'cheap-module-eval-source-map',
  resolve: {
    alias: {
      // Workaround https://github.com/Reactive-Extensions/RxJS/issues/832, until it's fixed
      'rx$': './node_modules/falcor/node_modules/rx/dist/rx.js',
    },
  },
}
