'use strict'
let gulp = require('gulp')
var babel = require('gulp-babel')
let runSequence = require('run-sequence')

gulp.task('appCode', () => {
  return gulp
    .src('app/**/*.js')
    .pipe(babel())
    .pipe(gulp.dest('dist/app'))
})

gulp.task('jade', () => {
  return gulp
    .src('app/**/*.jade')
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

gulp.task('libCode', () => {
  return gulp
    .src('lib/**/*.js')
    .pipe(babel())
    .pipe(gulp.dest('dist/lib'))
})

gulp.task('default', () => {
  return runSequence(
    'libCode',
    'appCode',
    'jade',
    'webpack',
    'assets'
  )
})
