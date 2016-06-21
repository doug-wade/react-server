const path    = require('path');
const gulp    = require('gulp');
const ava     = require('gulp-ava');
const nsp     = require('gulp-nsp');
const eslint  = require('gulp-eslint');
const plumber = require('gulp-plumber');
const gutil   = require('gulp-util');

gulp.task('ava', () => gulp.src('test/test.js')
	.pipe(plumber())
	.pipe(ava())
	.on('error', gutil.log)
);

gulp.task('eslint', [], () =>  gulp.src("index.js")
	.pipe(plumber())
	.pipe(eslint())
	.pipe(eslint.format())
	.pipe(eslint.failAfterError())
	.on('error', gutil.log)
);

gulp.task('nsp', (cb) => nsp({package: path.resolve('package.json')}, cb));

gulp.task('test', ['ava', 'nsp', 'eslint']);
