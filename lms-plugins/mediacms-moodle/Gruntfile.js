module.exports = function(grunt) {
    var path = require('path');

    grunt.initConfig({
        babel: {
            options: {
                sourceMap: true,
                presets: ['@babel/preset-env'],
                plugins: ['@babel/plugin-transform-modules-amd'],
                moduleIds: true,
                getModuleId: function(moduleName) {
                    // moduleName is the absolute or relative path to the file.
                    // We need to convert 'tiny/mediacms/amd/src/filename' to 'tiny_mediacms/filename'
                    var filename = path.basename(moduleName);
                    return 'tiny_mediacms/' + filename;
                }
            },
            dist: {
                files: [{
                    expand: true,
                    cwd: 'tiny/mediacms/amd/src',
                    src: ['*.js'],
                    dest: 'tiny/mediacms/amd/build',
                    ext: '.js'
                }]
            }
        },
        uglify: {
            options: {
                sourceMap: true,
                output: { comments: false }
            },
            dist: {
                files: [{
                    expand: true,
                    cwd: 'tiny/mediacms/amd/build',
                    src: ['*.js', '!*.min.js'],
                    dest: 'tiny/mediacms/amd/build',
                    ext: '.min.js'
                }]
            }
        }
    });

    grunt.loadNpmTasks('grunt-babel');
    grunt.loadNpmTasks('grunt-contrib-uglify');

    grunt.registerTask('default', ['babel', 'uglify']);
};
