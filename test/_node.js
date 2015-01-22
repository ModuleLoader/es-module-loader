'use strict';

global.expect = require('expect.js');

require('./_helper');

require('../lib');

require('./system.spec');

require('./custom-loader');
require('./custom-loader.spec');
