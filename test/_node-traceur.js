'use strict';

global.expect = require('expect.js');

require('./_helper');

global.System = require('../lib/index-traceur').System;

System.parser = 'traceur';

require('./system.spec');

require('./custom-loader');
require('./custom-loader.spec');
