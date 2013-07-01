# es6-module-loader

An ES6 Module Loader shim based on [http://wiki.ecmascript.org/doku.php?id=harmony:module_loaders](http://wiki.ecmascript.org/doku.php?id=harmony:module_loaders) and the initial work done by [Luke Hogan](https://gist.github.com/2246758).

## Getting Started

See the demo for the time being until further documentation is written.

## Examples


Define a new module

```
var module = new Module({test:'hello'});
console.log(module);
```

Define a new module Loader instance:

```
var loader = new Loader(Loader,{global: window,
    baseURL: document.URL.substring(0, document.URL.lastIndexOf('\/') + 1),
    strict: false,
    resolve: function (relURL, baseURL) {
      var url = baseURL + relURL;
      return url;
    },
    fetch: function (relURL, baseURL, request, resolved) {
      var url = baseURL + relURL;
      var xhr = new XMLHttpRequest();
      xhr.onreadystatechange = function () {
        if (xhr.readyState === 4) {
          if (xhr.status === 200) {
            request.fulfill(xhr.responseText);
          } else {
            request.reject(xhr.statusText);
          }
        }
      };
      xhr.open("GET", url, true);
      xhr.send(null);
    },
    translate: function (src, relURL, baseURL, resolved) {
      return src;
    }
  });

console.log(loader);
```

Using the Loader instance:

```
loader.load('js/test2.js',
    function(test) {
        console.log('test2.js loaded', test);
        test.foobar();
    }, function(err){
    	console.log(err);
	});


loader.load('js/libs/jquery-1.7.1.js',
    function(jQuery) {
        console.log('jQuery loaded', jQuery);
        $('body').css({'background':'blue'});
    }, function(err){
    	console.log(err);
	});
```

Use System (pre-configured Loader)

```
System.load('js/test1.js', function(test1){
	console.log('test1.js loaded', test1);
	test1.tester();
});
```

## Notes and roadmap

### Specification Notes

The polyfill is implemented exactly to the specification now, except for the following items:

* The `extra` metadata property is not yet handled in the resolve, as I can't tell what happens to this.
* The `fetch` function is given a different specification between the prototype (`Loader.prototype.fetch`) and loader instance (`options.fetch`). Since instance functions are provided on the instance object as in the @wycats essay (`System.normalize`, `System.fetch` etc), there seems to be a conflict between these.
* The `evalAsync` function doesn't yet throw an error when exports are present, which should be the case.
* The `ToModule` function isn't implemented, but should be simple. I just couldn't tell if this was to be created at `window.ToModule` or `Module.ToModule`.
* The intrinsics encapsulation is a tricky one to polyfill, but I have done my best based on a global prototype chain behaviour, where `global.__proto__ == intrinsics`. And `intrinsics.__proto__ == window`. All code is evaluated with the `window` and `this` properties referencing the `global` allowing full global encapsulation.

### Syntax Parsing

The ES6 Harmony parser is being used to do parsing, loaded only when necessary. This parser still uses an older syntax, which is currently the major critical issue to sort out for this polyfill.

The issue tracking this is here - https://code.google.com/p/esprima/issues/detail?id=410


## Contributing
In lieu of a formal styleguide, take care to maintain the existing coding style. Add unit tests for any new or changed functionality. Lint and test your code using [grunt](https://github.com/cowboy/grunt).

_Also, please don't edit files in the "dist" subdirectory as they are generated via grunt. You'll find source code in the "lib" subdirectory!_

## Release History
_(Nothing yet)_

## License
Copyright (c) 2012 Luke Hogan, Addy Osmani, Guy Bedford  
Licensed under the MIT license.
