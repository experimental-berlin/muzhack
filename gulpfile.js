'use strict'
let gulp = require('gulp')
var babel = require('gulp-babel')
let runSequence = require('run-sequence')
let sourcemaps = require('gulp-sourcemaps')

gulp.task('javascript', () => {
  return gulp
    .src(['app/**/*.js', 'lib/**/*.js', '!app/entry.js', '!app/lib/trello.js',], {
      base: '.',
    })
    .pipe(sourcemaps.init())
    .pipe(babel())
    .pipe(sourcemaps.write('.'))
    .pipe(gulp.dest('dist/'))
})

gulp.task('pug', () => {
  return gulp
    .src('app/**/*.pug')
    .pipe(gulp.dest('dist/app/'))
})

gulp.task('assets', () => {
  return gulp
    .src('public/**/*')
    .pipe(gulp.dest('dist/public/'))
})

gulp.task('webpack', () => {
  return gulp
    .src('dist/bundle.js')
    .pipe(gulp.dest('dist/dist/'))
})

gulp.task('default', () => {
  return runSequence(
    'javascript',
    'pug',
    'webpack',
    'assets'
  )
})
