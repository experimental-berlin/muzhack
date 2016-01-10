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

gulp.task('libCode', () => {
  return gulp
    .src('lib/**/*.js')
    .pipe(babel())
    .pipe(gulp.dest('dist/lib'))
})

gulp.task('default', () => {
  return runSequence(
    'libCode',
    'appCode'
  )
})
