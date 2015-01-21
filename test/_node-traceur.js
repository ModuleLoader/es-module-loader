'use strict';

global.expect = require('expect.js');

require('./_helper');

require('../lib/index-traceur');

require('./system.spec');

require('./custom-loader');
require('./custom-loader.spec');
