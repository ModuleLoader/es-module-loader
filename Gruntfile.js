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
          'dist/<%= pkg.name %>-strict.src.js': [
            'src/wrapper-start.js',
            'src/loader.js',
            'src/dynamic-only.js',
            'src/url-polyfill.js',
            'src/system.js',
            'src/wrapper-end.js'
          ],
          'dist/<%= pkg.name %>-dev-strict.src.js': [
            'src/wrapper-start.js',
            'src/loader.js',
            'src/declarative.js',
            'src/transpiler.js',
            'src/url-polyfill.js',
            'src/system.js',
            'src/module-tag.js',
            'src/wrapper-end.js'
          ]
        }
      }
    },
    preprocess: {
      multifile: {
        files: {
          'dist/es6-module-loader-dev.src.js': 'dist/es6-module-loader-dev-strict.src.js',
          'dist/es6-module-loader.src.js': 'dist/es6-module-loader-strict.src.js'
        },
        context: {
          STRICT: true
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
        src: 'dist/<%= pkg.name %>.src.js',
        dest: 'dist/<%= pkg.name %>.js'
      },
      distStrict: {
        src: 'dist/<%= pkg.name %>-strict.src.js',
        dest: 'dist/<%= pkg.name %>-strict.js'
      },
      distDev: {
        src: 'dist/<%= pkg.name %>-dev.src.js',
        dest: 'dist/<%= pkg.name %>-dev.js'
      },
      distDevStrict: {
        src: 'dist/<%= pkg.name %>-dev-strict.src.js',
        dest: 'dist/<%= pkg.name %>-dev-strict.js'
      }
    }
  });

  grunt.loadNpmTasks('grunt-contrib-jshint');
  grunt.loadNpmTasks('grunt-contrib-concat');
  grunt.loadNpmTasks('grunt-contrib-uglify');
  grunt.loadNpmTasks('grunt-preprocess');

  grunt.registerTask('lint', ['jshint']);
  grunt.registerTask('compile', ['concat']);
  grunt.registerTask('default', [/*'jshint', */'concat', 'preprocess', 'uglify']);
};
