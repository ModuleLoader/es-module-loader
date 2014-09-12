(function(__global) {
  
  $__Object$getPrototypeOf = Object.getPrototypeOf || function(obj) {
    return obj.__proto__;
  };

  var defineProperty;
  (function () {
    try {
      if (!!Object.defineProperty({}, 'a', {})) {
        defineProperty = Object.defineProperty;
      }
    } catch (e) {
      defineProperty = function (obj, prop, opt) {
        try {
          obj[prop] = opt.value || opt.get.call(obj);
        }
        catch(e) {}
      }
    }
  }());
  $__Object$defineProperty = defineProperty;

  $__Object$create = Object.create || function(o, props) {
    function F() {}
    F.prototype = o;

    if (typeof(props) === "object") {
      for (prop in props) {
        if (props.hasOwnProperty((prop))) {
          F[prop] = props[prop];
        }
      }
    }
    return new F();
  };
