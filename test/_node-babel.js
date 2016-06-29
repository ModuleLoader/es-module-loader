'use strict';

global.expect = require('expect.js');

require('./_helper');

require('regenerator-runtime/runtime');

global.System = require('../index').System;
global.Reflect = require('../index').Reflect;

global.System.transpiler = 'babel';

require('./system.normalize.spec');
require('./system.spec');

require('./custom-loader');
require('./custom-loader.spec');
