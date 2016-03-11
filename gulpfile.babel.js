import gulp from "gulp";
import del from "del";
import eslint from "gulp-eslint";
import babel from "gulp-babel";
import RemoveStylesheetImports from "@redfin/babel-plugin-remove-stylesheet-imports";
import RewriteStingrayImports from "@redfin/babel-plugin-rewrite-stingray-imports";

const JS_FILES = ["./src/**/*.js"];

gulp.task("default", ["build"])

gulp.task("prepublish", ["build"]);

gulp.task("build", ["compile-js", "compile-stingray-js"])

gulp.task("lint", ["clean"], function(cb) {
	gulp.src(JS_FILES)
		.pipe(eslint())
		.pipe(eslint.format())
		.pipe(eslint.failAfterError());
	cb();
});

gulp.task("compile-js", ["lint"], () => {
	return gulp.src(JS_FILES)
		.pipe(babel())
		.pipe(gulp.dest("./"));
});

gulp.task("compile-stingray-js", ["lint"], () => {
	return gulp.src(JS_FILES)
		.pipe(babel({
			plugins: [
				RemoveStylesheetImports,
				RewriteStingrayImports,
				"transform-es2015-modules-amd",
			],
		}))
		.pipe(babel({
			// The transform-es2015-modules-amd plugin has a regression as
			// of November 2015 or so where reserved words like "default"
			// are not being quoted properly. This upsets Dojo's rollup
			// builder. Adding these plugins to the list above doesn't
			// work, but doing them in a second Babel pass does.
			//     https://phabricator.babeljs.io/T2817
			//     https://phabricator.babeljs.io/T6863
			plugins: [
				"transform-es3-member-expression-literals",
				"transform-es3-property-literals",
			],

			// Avoid redundant inherited steps.
			babelrc: false,
		}))
		.pipe(gulp.dest("./stingray/"));
});

gulp.task("clean", (cb) => {
	del([
		"./has.js",
		"./stingray",
	]);
	cb();
});
