'use strict';

global.expect = require('expect.js');

require('./_helper');

global.System = require('../index').System;
global.Reflect = require('../index').Reflect;

require('./system.normalize.spec');
require('./system.spec');

require('./custom-loader');
require('./custom-loader.spec');
