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
      {
        test: /\.styl$/,
        loader: 'style-loader!raw!stylus-loader',
      },
      {
        test: /\.css$/,
        loader: 'style-loader!css-loader',
      },
      {
        test: /\.(eot|woff|woff2|ttf|svg)($|\?)/,
        loader: 'url-loader?limit=30000&name=[name]-[hash].[ext]',
      },
      {
        test: /(isotope|masonry|outlayer|item|get-size|fizzy-ui-utils\/utils)\.js$/,
        loader: 'imports?define=>false',
      },
      {
        test: /\.json$/,
        loader: 'json-loader',
      },
      {
        test: /\.coffee$/,
        loader: 'coffee-loader',
        exclude: /node_modules/,
      },
      {
        test: /\.scss$/,
        loader: 'style!css!sass',
        exclude: /node_modules/,
      },
    ],
  },
  debug: true,
  devtool: 'cheap-module-eval-source-map',
  resolve: {
    root: ['/',],
    extensions: ['', '.js',],
    alias: {
      // Workaround https://github.com/Reactive-Extensions/RxJS/issues/832, until it's fixed
      'rx$': './node_modules/falcor/node_modules/rx/dist/rx.js',
    },
  },
  devServer: {
    historyApiFallback: false,
    proxy: {
      '*': 'http://localhost:8000',
    },
  },
}
