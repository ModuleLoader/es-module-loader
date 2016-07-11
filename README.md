# ES6 Module Loader Polyfill [![Build Status][travis-image]][travis-url]

Dynamically loads ES6 modules in browsers and NodeJS with support for loading existing and custom module formats through loader hooks.

### Specifications
ES6/ES2015 introduces native support for JavaScript modules, self-standing pieces of code which execute in their own scope and import values exported by other modules. Originally, the specification included the loader, and this polyfill was created to support those loader functions in current browsers and in NodeJS.

The final specification, though, only defines the [language-specific semantics of modules](http://www.ecma-international.org/ecma-262/6.0/#sec-modules), leaving implementations of the loading of those modules to separate specifications. The dynamic configurable loader is being specified at the [WhatWG loader spec](https://whatwg.github.io/loader/), and from version 0.50 this polyfill implements that.

Support for static loading of modules from HTML using `<script type="module">` tags has also been added to the [WhatWG HTML specification](https://html.spec.whatwg.org/multipage/scripting.html#the-script-element). This adapts the existing script-loading mechanism to include the loading of 'module scripts' together with all the other modules on which those module scripts depend. However, this currently has no interface with the WhatWG loader, and consequently with this polyfill. Eventually, both loading mechanisms should share a module registry, and the WhatWG loader resolution hooks should apply to the loading of module scripts as well.

### Support status June 2016
* ES6 is now [widely supported](http://kangax.github.io/compat-table/es6/) in the main browsers and in NodeJS.
* Browser support for module scripts is being implemented, currently behind flags; it's likely to be a while before this is usable in production systems.
* The WhatWG loader is not finalized and is unstable and liable to change. Consequently, this polyfill is also liable to change. This is unlikely to be implemented in browsers until stable.

### WhatWG loader status June 2016
* 'Provides a pipeline for on-demand, asynchronous loading of JavaScript modules'. This pipeline consists of URL resolution, plus three loading stages.
* Defines a `Loader` class in the (new to ES2015) `Reflect` global object, with `import`, `resolve` and `load` prototype methods. `import` is the standard method for dynamically importing a module together with its dependencies, and combines `resolve` and `load`. `load` can initiate the loading pipeline at any stage. What loading stages are needed depends on the host environment.
* The `Loader` class also includes a module `Registry`, which is a `Symbol.iterator`.
* Introduces a `System` global object, with an instance of `Reflect.Loader` as the `loader` property; this is the default browser loader. In addition to the `Loader` methods, this has prototype methods corresponding to the pipeline stages: `resolve`, `fetch`, `translate` and `instantiate`. The last two are by default no-ops, but all these methods are programmable hooks, enabling the creation of custom loaders which can intervene in the pipeline by specifying custom code for one or more hooks.
* Defines a `Module` constructor in the `Reflect` global for dynamic construction of modules from within script or module code.

### This polyfill
* Implements `Reflect.Loader`, providing the ability for developers to create custom loader instances.
* Implements the module registry
* Implements `Reflect.Module`
* Implements the `System.loader` default `Reflect.Loader` class instance, which means that `System.loader.import` can be used to dynamically load ES6 modules.
* Until the parsing of `import` and `export` statements are natively supported, supports both [Traceur](https://github.com/google/traceur-compiler) and [Babel](http://babeljs.io/) for transpiling these statements; this requires loading a large parser, so is not suitable for production use.
* Provides a standards-based hookable loader, so users can create their own custom loaders with it.
* Fully supports ES6 circular references and live bindings.
* Targets modern browsers, all of which now support the great bulk of ES6.

### Differences with versions prior to 0.50
* As the target browsers support ES6, no polyfills are included; applications wanting to support older browsers, such as IE, need to include polyfills for `Map`, `Symbol.iterator`, and `Promise`, as well as `URL()`; https://cdn.polyfill.io provides a simple way to do this.
* For use in NodeJS, support for `Map`, `Symbol.iterator`, and `Promise` is needed, so NodeJS v4+ is required (v6+ is recommended).
* As only `import` and `export` are transpiled, those wanting to support older browsers should also pre-transpile any ES6 code into ES5.
* What was previously in the `System` object, for example `System.import`, is now in `System.loader` (applications can of course supply an alias to ease the transition).
* The previous `normalize` and `locate` methods have now been combined into the `resolve` method.
* The `Module` constructor has been moved to the `Reflect` object.
* Although the WhatWG loader will eventually define a `site` object, which will probably include some kind of module name/URL mapping, this is not currently defined and so is not included in the current polyfill; this means there is no longer any `baseURL` or `paths` support. For compatibility with module scripts, the default loader supports absolute URLs and relative URLs starting with `/`, `./` and `../` in `import` statements (this is relative to the URL of the importing module).

For an example of approaches for using the loader in production, see [SystemJs](https://github.com/systemjs/systemjs/) which hooks in functionality such as supporting ES6 modules through the System.register transpiled format and its own custom module resolution mechanism.

## Contributing
Changing to the new loader spec is quite a lot of work, so contributions are welcome.

In lieu of a formal styleguide, take care to maintain the existing coding style. Add unit tests for any new or changed functionality. Lint and test your code using [grunt](https://github.com/cowboy/grunt).

_Also, please don't edit files in the "dist" subdirectory as they are generated via grunt. You'll find source code in the "lib" subdirectory!_

##Contributors
Guy Bedford  
Joel Denning  
Luke Hoban  
Addy Osmani  
Peter Robins

## License
Licensed under the MIT license.

[travis-url]: https://travis-ci.org/ModuleLoader/es6-module-loader
[travis-image]: https://travis-ci.org/ModuleLoader/es6-module-loader.svg?branch=master
