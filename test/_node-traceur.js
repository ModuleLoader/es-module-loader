'use strict';

global.expect = require('expect.js');

require('./_helper');

require('traceur');

global.System = require('../lib/index-traceur').System;
global.Reflect = require('../lib/index-traceur').Reflect;

require('./system.spec');

require('./custom-loader');
require('./custom-loader.spec');
