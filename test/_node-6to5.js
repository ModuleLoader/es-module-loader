'use strict';

global.expect = require('expect.js');

require('./_helper');

require('../lib/index-6to5');

require('./system.spec');

require('./custom-loader');
require('./custom-loader.spec');
