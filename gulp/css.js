const { src, dest, watch, series } = require('gulp');

const autoprefixer = require('gulp-autoprefixer');
const cleancss = require('gulp-clean-css');
const concat = require('gulp-concat');
const postcss = require('gulp-postcss');
const nested = require('postcss-nested');

/** Run all scripts. */
exports.all = (cb) => {
    return series(AllInOne)(cb);
};

const dist = {
    'files': [
        'src/css/main.css',
    ],
    'outputFolder': 'dist/css',
}

/** Run all scripts. */
const AllInOne = (cb, input, output) => {
    return src(dist.files)
        .pipe(postcss([nested()]))
        .pipe(autoprefixer())
        .pipe(cleancss())
        .pipe(concat('all.css'))
        .pipe(dest(dist.outputFolder));
};

/** Put a watch on all files. */
exports.watch = CSSwatch = cb => {
    return watch(dist.files)
        .on('change', path => {
            console.log('Change detected to .scss file "' + path + '"');
            series(AllInOne)(() => {
                console.log('CSS compiled and concatenated.');
            });
    });
};