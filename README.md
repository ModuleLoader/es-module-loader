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

## Pending changes

* Get rid of `eval` (and stop the linter from complaining about it in the process) 
* `ToModule(obj)` not implemented. Can it be? We're currently creating object instances as 'module' instances can't be properly done till ES6 is natively available
* Tests? Should be fairly straight-forward. Can be based on what is in the demo.
* Improve documentation (inline or otherwise)


## Contributing
In lieu of a formal styleguide, take care to maintain the existing coding style. Add unit tests for any new or changed functionality. Lint and test your code using [grunt](https://github.com/cowboy/grunt).

_Also, please don't edit files in the "dist" subdirectory as they are generated via grunt. You'll find source code in the "lib" subdirectory!_

## Release History
_(Nothing yet)_

## License
Copyright (c) 2012 Luke Hogan, Addy Osmani  
Licensed under the MIT license.
