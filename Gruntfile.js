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
          'dist/<%= pkg.name %>.src.js': [
            'src/wrapper-start.js',
            'src/loader.js',
            'src/dynamic-only.js',
            'src/url-polyfill.js',
            'src/system.js',
            'src/wrapper-end.js'
          ],
          'dist/<%= pkg.name %>-dev.src.js': [
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
      distDev: {
        src: 'dist/<%= pkg.name %>-dev.src.js',
        dest: 'dist/<%= pkg.name %>-dev.js'
      }
    }
  });

  grunt.loadNpmTasks('grunt-contrib-jshint');
  grunt.loadNpmTasks('grunt-contrib-concat');
  grunt.loadNpmTasks('grunt-contrib-uglify');

  grunt.registerTask('lint', ['jshint']);
  grunt.registerTask('compile', ['concat']);
  grunt.registerTask('default', [/*'jshint', */'concat', 'uglify']);
};
