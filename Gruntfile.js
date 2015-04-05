'use strict';

module.exports = function (grunt) {
  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),
    meta: {
      banner: '/*\n *  <%= pkg.name %> v<%= pkg.version %>\n' +
        '<%= pkg.homepage ? " *  " + pkg.homepage + "\\n" : "" %>' +
        ' *  Copyright (c) <%= grunt.template.today("yyyy") %> <%= pkg.author.name %>;' +
        ' Licensed <%= _.pluck(pkg.licenses, "type").join(", ") %>\n */'
    },
    jshint: {
      options: {
        jshintrc: '.jshintrc'
      },
      dist: [
        'lib/index.js'
      ]
    },
    concat: {
      dist: {
        files: {
          'dist/<%= pkg.name %>-prod.src.js': [
            'node_modules/when/es6-shim/Promise.js',
            'src/wrapper-start.js',
            'src/loader.js',
            'src/dynamic-only.js',
            'src/url.js',
            'src/system.js',
            'src/wrapper-end.js'
          ],
          'dist/<%= pkg.name %>.src.js': [
            'node_modules/when/es6-shim/Promise.js',
            'src/wrapper-start.js',
            'src/loader.js',
            'src/declarative.js',
            'src/transpiler.js',
            'src/url.js',
            'src/system.js',
            'src/module-tag.js',
            'src/wrapper-end.js'
          ]
        }
      }
    },
    uglify: {
      options: {
        banner: '<%= meta.banner %>\n',
        compress: {
          drop_console: true
        },
        sourceMap: true
      },
      dist: {
        options: {
          banner: '<%= meta.banner %>\n'
        },
        src: 'dist/<%= pkg.name %>.src.js',
        dest: 'dist/<%= pkg.name %>.js'
      },
      prodDist: {
        options: {
          banner: '<%= meta.banner %>\n'
        },
        src: 'dist/<%= pkg.name %>-prod.src.js',
        dest: 'dist/<%= pkg.name %>-prod.js'
      }
    }
  });

  grunt.loadNpmTasks('grunt-contrib-jshint');
  grunt.loadNpmTasks('grunt-contrib-uglify');
  grunt.loadNpmTasks('grunt-contrib-concat');

  grunt.registerTask('lint', ['jshint']);
  grunt.registerTask('compile', ['concat']);
  grunt.registerTask('default', [/*'jshint', */'concat', 'uglify']);
};
