'use strict';

global.expect = require('expect.js');

require('./_helper');

require('regenerator/runtime');

global.System = require('../lib/index-babel').System;

require('./system.spec');

require('./custom-loader');
require('./custom-loader.spec');
