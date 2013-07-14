'use strict';
module.exports = function (grunt) {
  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),
    meta: {
      banner: '/*!\n*  <%= pkg.name %> - v<%= pkg.version %> - ' +
        '<%= grunt.template.today("m/d/yyyy") %>' + "\n" +
        '<%= pkg.homepage ? "*  " + pkg.homepage + "\\n" : "" %>' +
        '*  Copyright (c) <%= grunt.template.today("yyyy") %> <%= pkg.author.name %>;' +
        ' Licensed <%= _.pluck(pkg.licenses, "type").join(", ") %>\n*/\n'
    },
    uglify: {
      options: {
        banner: '<%= meta.banner %>'
      },
      dist: {
          src: 'lib/<%= pkg.name %>.js',
          dest: 'dist/<%= pkg.name %>.min.js'
      }
    },
    jshint: {
      options: {
        jshintrc: '.jshintrc'
      },
      dist: [
        'lib/es6-module-loader.js',
        'test/es6-module-loader_test.js'
      ]
    }
  });

  grunt.loadNpmTasks('grunt-contrib-jshint');
  grunt.loadNpmTasks('grunt-contrib-uglify');

  grunt.registerTask('default', ['jshint', 'uglify']);
};
