'use strict';
module.exports = function (grunt) {
  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),
    meta: {
      banner: '/*\n *  <%= pkg.name %> v<%= pkg.version %>\n' +
        '<%= pkg.homepage ? " *  " + pkg.homepage + "\\n" : "" %>' +
        ' *  Implemented to the 2013-12-02 ES6 module specification draft\n' +
        ' *  Copyright (c) <%= grunt.template.today("yyyy") %> <%= pkg.author.name %>;' +
        ' Licensed <%= _.pluck(pkg.licenses, "type").join(", ") %>\n */'
    },
    jshint: {
      options: {
        jshintrc: '.jshintrc'
      },
      dist: [
        'lib/index.js',
        'lib/promise.js',
        'lib/loader.js',
        'lib/system.js'
      ]
    },
    concat: {
      dist: {
        src: [
          'lib/promise.js',
          'lib/module.js',
          'lib/loader.js',
          'lib/system.js'
        ],
        dest: 'tmp/<%= pkg.name %>.js'
      },
      polyfillOnly: {
        src: [
          'lib/module.js',
          'lib/loader.js',
          'lib/system.js'
        ],
        dest: 'tmp/<%= pkg.name %>-sans-promises.js'
      }
    },
    uglify: {
      options: {
        banner: '<%= meta.banner %>\n',
        compress: {
          drop_console: true
        }
      },
      dist: {
        options: {
          banner: '<%= meta.banner %>\n'
          + '/*\n *  ES6 Promises shim from when.js, Copyright (c) 2010-2014 Brian Cavalier, John Hann, MIT License\n */\n'
        },
        src: 'tmp/<%= pkg.name %>.js',
        dest: 'dist/<%= pkg.name %>.js'
      },
      polyfillOnly: {
        src: 'tmp/<%= pkg.name %>-sans-promises.js',
        dest: 'dist/<%= pkg.name %>-sans-promises.js'
      }
    }
  });

  grunt.loadNpmTasks('grunt-contrib-concat');
  grunt.loadNpmTasks('grunt-contrib-jshint');
  grunt.loadNpmTasks('grunt-contrib-uglify');

  grunt.registerTask('lint', ['jshint']);
  grunt.registerTask('default', [/*'jshint', */'concat', 'uglify']);
};
