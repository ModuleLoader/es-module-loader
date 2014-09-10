$__Object$getPrototypeOf = Object.getPrototypeOf || function(obj) {
  return obj.__proto__;
};
$__Object$defineProperty = (function () {
  try {
    if (!!Object.defineProperty({}, 'a', {})) {
      return Object.defineProperty;
    }
  } catch (e) {
    return function (obj, prop, opt) {
      try {
        obj[prop] = opt.value || opt.get.call(obj);
      }
      catch(e) {}
    }
  }
}());
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
