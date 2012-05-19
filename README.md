# es6-module-loader

An ES6 Module Loader shim based on [http://wiki.ecmascript.org/doku.php?id=harmony:module_loaders](http://wiki.ecmascript.org/doku.php?id=harmony:module_loaders) and the initial work done by [Luke Hogan](https://gist.github.com/2246758).

## Getting Started

See the demo for the time being until further documentation is written.

## Documentation
_(Coming soon)_

## Examples
_(Coming soon)_

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
