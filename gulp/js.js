const { src, dest, watch, series } = require('gulp');

const concat = require('gulp-concat');
const uglify = require('gulp-uglify');

/** Run all scripts. */
exports.all = (cb) => {
    return series(AllInOne)(cb);
};

const dist = {
    'files': [
        'src/js/main.js',
    ],
    'outputFolder': 'dist/js',
}

// Transpile the specified JS files to a concatenated and minified file
const AllInOne = (cb, input, output) => {
    return src(dist.files)
        .pipe(concat('all.js'))    
        .pipe(uglify())
        .on('error', (err) => {
            console.error('Error:', err.message);
            this.emit('end'); // Continue on error
        })
        .pipe(concat('all.min.js'))
        .pipe(dest(dist.outputFolder));
};

/** Put a watch on all files. */
exports.watch = JSwatch = cb => {
    return watch(dist.files)
        .on('change', path => {
            console.log('Change detected to .js file "' + path + '"');
            series(AllInOne)(() => {
                console.log('JS compiled and concatenated.');
            });
    });
};