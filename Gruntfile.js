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
            'node_modules/when/es6-shim/Promise.js',
            'src/polyfill-wrapper-start.js',
            'src/loader.js',
            'src/parser.js',
            'src/url.js',
            'src/system.js',
            'src/module-tag.js',
            'src/polyfill-wrapper-end.js'
          ],
          'dist/<%= pkg.name %>-sans-promises.src.js': [
            'src/polyfill-wrapper-start.js',
            'src/loader.js',
            'src/parser.js',
            'src/url.js',
            'src/system.js',
            'src/module-tag.js',
            'src/polyfill-wrapper-end.js'
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
      distSansPromises: {
        src: 'dist/<%= pkg.name %>-sans-promises.src.js',
        dest: 'dist/<%= pkg.name %>-sans-promises.js'
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
