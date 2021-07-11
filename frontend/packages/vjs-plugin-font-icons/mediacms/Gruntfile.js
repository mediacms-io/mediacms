require('@babel/register');

module.exports = function(grunt) {
  require('time-grunt')(grunt);
  require('load-grunt-tasks')(grunt);

  require('./grunt.js')(grunt);
};
