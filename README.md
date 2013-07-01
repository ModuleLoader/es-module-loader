# ES6 Module Loader

An ES6 Module Loader polyfill based on [http://wiki.ecmascript.org/doku.php?id=harmony:module_loaders](http://wiki.ecmascript.org/doku.php?id=harmony:module_loaders) by Luke Hoban, Addy Osmani and Guy Bedford.

Not yet suitable for production use while the specification is still subject to change.

## Getting Started

Check-out the [demo](http://moduleloader.github.io/es6-module-loader/demo/index.html) sample to see the project in action.

Use the System (pre-configured Loader):

```javascript
System.baseURL = '/lib';
System.import('js/test1', function (test1) {
  console.log('test1.js loaded', test1);
});
```

where, test1 can contain module syntax:

test1.js:

```javascript
export function tester() {
  console.log('hello!');
}
```

Load multiple modules:

```javascript
System.import(['js/test1', 'js/test2'], function(test1, test2) {
  console.log('test1.js loaded', test1);
  console.log('test2.js loaded', test2);
}, function(err) {
  console.log('loading error');
});
```

Load a plain JavaScript file from a URL:

```javascript
System.load('js/libs/jquery-1.7.1.js', function() {
  var $ = System.global.jQuery;
  console.log('jQuery loaded', $);
  $('body').css({'background':'blue'});
});
```

Define a new module Loader instance:

```javascript
var loader = new Loader(Loader, {
  global: window,
  strict: false,
  resolve: function (normalized, options) {
    return '/' + normalized + '.js';
  },
  fetch: function (url, fulfill, reject, options) {
    var xhr = new XMLHttpRequest();
    xhr.onreadystatechange = function () {
      if (xhr.readyState === 4) {
        if (xhr.status === 200) {
          fulfill(xhr.responseText);
        } else {
          reject(xhr.statusText);
        }
      }
    };
    xhr.open("GET", url, true);
    xhr.send(null);
  },
  translate: function (source, options) {
    return source;
  }
});
```

Define an ES6 module programatically (useful in optimized / production environments):

```javascript
var module = new Module({ test: 'hello' });
System.set('my-module', module);
console.log(System.get('my-module'));
```


## Notes and roadmap

### Specification Notes

The polyfill is implemented exactly to the specification now, except for the following items:

* The `extra` metadata property is not yet handled in the resolve.
* The `fetch` function is given a different specification between the prototype (`Loader.prototype.fetch`) and loader instance (`options.fetch`). Since instance functions are provided on the instance object as in the @wycats essay (`System.normalize`, `System.fetch` etc), there seems to be a conflict between these.
* The `evalAsync` function doesn't yet throw an error when exports are present, which should be the case.
* The `ToModule` function isn't implemented, but should be simple. 
* The intrinsics encapsulation is a tricky one to polyfill, but we have done our best based on a global prototype chain behaviour, where `global.__proto__ == intrinsics`. And `intrinsics.__proto__ == window`. All code is evaluated with the `window` and `this` properties referencing the `global` allowing full global encapsulation.

### Syntax Parsing

The [Esprima ES6 Harmony parser](https://github.com/ariya/esprima/tree/harmony) is being used to do parsing, loaded only when necessary. This parser still uses an older syntax, which is currently the major critical issue to sort out for this polyfill.

The issue tracking this is here - https://github.com/ModuleLoader/es6-module-loader/issues/10


## Contributing
In lieu of a formal styleguide, take care to maintain the existing coding style. Add unit tests for any new or changed functionality. Lint and test your code using [grunt](https://github.com/cowboy/grunt).

_Also, please don't edit files in the "dist" subdirectory as they are generated via grunt. You'll find source code in the "lib" subdirectory!_

## Release History
_(Nothing yet)_

## License
Copyright (c) 2012 Luke Hoban, Addy Osmani, Guy Bedford  
Licensed under the MIT license.
