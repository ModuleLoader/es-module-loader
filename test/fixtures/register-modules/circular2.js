System.register(['./circular1.js'], function (_export, _context) {
  "use strict";

  var fn1, variable1, variable2, output;
  function fn2() {
    _export('output', output = variable1);
  }

  _export('fn2', fn2);

  return {
    setters: [function (_circular1Js) {
      fn1 = _circular1Js.fn1;
      variable1 = _circular1Js.variable1;
      var _exportObj = {};
      _exportObj.output1 = _circular1Js.output;

      _export(_exportObj);
    }],
    execute: function () {
      _export('variable2', variable2 = 'test circular 2');

      _export('variable2', variable2);

      fn1();

      _export('output', output);
    }
  };
});