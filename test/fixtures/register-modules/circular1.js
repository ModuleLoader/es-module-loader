System.register(['./circular2.js'], function (_export, _context) {
  "use strict";

  var fn2, variable2, variable1, output;
  function fn1() {
    _export('output', output = variable2);
  }

  return {
    exports: {
      fn1: fn1,
      variable1: undefined,
      output: undefined,
      output2: undefined
    },
    setters: [function (_circular2Js) {
      fn2 = _circular2Js.fn2;
      variable2 = _circular2Js.variable2;
      var _exportObj = {};
      _exportObj.output2 = _circular2Js.output;

      _export(_exportObj);
    }],
    execute: function () {
      _export('variable1', variable1 = 'test circular 1');

      _export('variable1', variable1);

      fn2();

      _export('output', output);
    }
  };
});
