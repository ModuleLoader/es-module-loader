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
          'dist/<%= pkg.name %>-traceur.src.js': [
            'node_modules/when/es6-shim/Promise.js',
            'src/polyfill-wrapper-start.js',
            'dist/<%= pkg.name %>-traceur.js',
            'src/polyfill-wrapper-end.js'
          ],
          'dist/<%= pkg.name %>-6to5.src.js': [
            'node_modules/when/es6-shim/Promise.js',
            'src/polyfill-wrapper-start.js',
            'dist/<%= pkg.name %>-6to5.js',
            'src/polyfill-wrapper-end.js'
          ],
          'dist/<%= pkg.name %>-traceur-sp.src.js': [
            'src/polyfill-wrapper-start.js',
            'dist/<%= pkg.name %>-traceur.js',
            'src/polyfill-wrapper-end.js'
          ],
          'dist/<%= pkg.name %>-6to5-sp.src.js': [
            'src/polyfill-wrapper-start.js',
            'dist/<%= pkg.name %>-6to5.js',
            'src/polyfill-wrapper-end.js'
          ]
        }
      }
    },
    esnext: {
      distTraceur: {
        src: [
          'src/loader.js',
          'src/traceur-loader.js',
          'src/system.js'
        ],
        dest: 'dist/<%= pkg.name %>-traceur.js'
      },
      dist6to5: {
        src: [
          'src/loader.js',
          'src/6to5-loader.js',
          'src/system.js'
        ],
        dest: 'dist/<%= pkg.name %>-6to5.js'
      }
    },
    'string-replace': {
      dist: {
        files: {
          'dist/<%= pkg.name %>.js': 'dist/<%= pkg.name %>.js'
        },
        options: {
          replacements:[{
            pattern: 'var $__Object$getPrototypeOf = Object.getPrototypeOf;\n' +
              'var $__Object$defineProperty = Object.defineProperty;\n' +
              'var $__Object$create = Object.create;',
            replacement: ''
          }, {
            pattern: '$__Object$getPrototypeOf(SystemLoader.prototype).constructor',
            replacement: '$__super'
          }]
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
      distTraceur: {
        options: {
          banner: '<%= meta.banner %>\n'
        },
        src: 'dist/<%= pkg.name %>-traceur.src.js',
        dest: 'dist/<%= pkg.name %>-traceur.js'
      },
      dist6to5: {
        options: {
          banner: '<%= meta.banner %>\n'
        },
        src: 'dist/<%= pkg.name %>-6to5.src.js',
        dest: 'dist/<%= pkg.name %>-6to5.js'
      },
      distTraceurSansPromises: {
        src: 'dist/<%= pkg.name %>-traceur-sp.src.js',
        dest: 'dist/<%= pkg.name %>-traceur-sp.js'
      },
      dist6to5SansPromises: {
        src: 'dist/<%= pkg.name %>-6to5-sp.src.js',
        dest: 'dist/<%= pkg.name %>-6to5-sp.js'
      }
    }
  });

  grunt.loadNpmTasks('grunt-contrib-jshint');
  grunt.loadNpmTasks('grunt-contrib-uglify');
  grunt.loadNpmTasks('grunt-esnext');
  grunt.loadNpmTasks('grunt-contrib-concat');
  grunt.loadNpmTasks('grunt-string-replace');

  grunt.registerTask('lint', ['jshint']);
  grunt.registerTask('compile', ['esnext', 'string-replace', 'concat']);
  grunt.registerTask('default', [/*'jshint', */'esnext', 'string-replace', 
                     'concat', 'uglify']);
};
