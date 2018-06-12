### What it is

System.register can be considered as a new module format designed to support the exact semantics of ES6 modules within ES5. The latest iteration (as of [ES Module Loader 2.3.0](https://github.com/ModuleLoader/es-module-loader/releases/tag/2.3.0) / [SystemJS 0.21.4](https://github.com/systemjs/systemjs/releases/tag/0.21.4)) also includes support for top-level await via a Promise return from the execute function.

It is a format that was developed out of collaboration and is supported as a module output in Traceur (as _instantiate_), 
Babel, TypeScript and Rollup (as _system_). All dynamic binding and circular reference behaviors supported by ES6 modules are supported 
by this format. In this way it acts as a safe and comprehensive target format for the polyfill path into ES6 modules.

To run the format, a suitable loader implementation needs to be used that understands how to execute it. Currently these include 
[SystemJS](https://github.com/systemjs/systemjs), [SystemJS Self-Executing Bundles](https://github.com/systemjs/builder#sfx-bundles) 
and [ES6 Micro Loader](https://github.com/caridy/es6-micro-loader). The ES6 Module Loader polyfill also uses this format 
internally when transpiling and executing ES6.

#### Bundled vs On-Demand

Just like AMD define, System.register can be both named and anonymous.

When a module name string is provided as the first argument in the `System.register` call, the format is suitable for 
naming multiple modules in the same JS file creating a bundle format.

When files are separately compiled, with only one `System.register` call per module, the name should not be set. 
This allows the importing environment to name the module into whatever namespace it likes without imposing a specific 
schema for maximum portability.

### How it works

When compiling ES6 modules to ES5, the Traceur `instantiate` output and Babel `system` output generates something like the following:

```javascript
  import { p as q } from './dep';
 
  var s = 'local';
  
  export function func() {
    return q;
  }

  export class C {
  }
```

->

```javascript
  System.register(['./dep'], function($__export, $__moduleContext) {
    var s, C, q;
    function func() {
      return q;
    }
    $__export('func', func);
    return {
      setters: [
      // every time a dependency updates an export, 
      // this function is called to update the local binding
      // the setter array matches up with the dependency array above
      function(m) {
        q = m.p;
      }
      ],
      execute: function() {
        // use the export function to update the exports of this module
        s = 'local';
        $__export('C', C = $traceurRuntime.createClass(...));
      }
    };
  });
```

Initial exports and changes to exports are pushed through the setter function, `$__export`. Values of dependencies and 
changes to dependency bindings are set through the dependency setters, `setters`, corresponding to the `$__export` calls of dependencies.

Functions and variables get hoisted into the declaration scope. This outer function sets up all the bindings, 
and the execution is entirely separated from this process. Hoisted functions are immediately exported. 
All of the modules in the tree first run this first function setting up all the bindings. 
Then we separately run all the execution functions left to right from the bottom of the tree ending at circular references.

In this way we get the live binding and circular reference support exactly as expected by the spec, 
while supporting ES3 environments for the module syntax conversion.

#### Why the System.register name

Since `System` is the loader name, `System.register` is a function that allows us to _define_ a module directly into the loader instance.

Note that the loader name is not fixed and can be changed here. For example to `SystemJS.register` in the case of bundling for SystemJS.

When code is executed, we only need to assume that `System` is in the scope of execution.

This then has the same advantages of the AMD `define` function in that it is a CSP-compatible output mechanism, allowing support
in environments where _eval_ is not supported, which would be necessary for other types of plain script outputs.

#### Why deferred execution

The use of `return { setters: ..., execute: ... }` is done instead of direct execution to allow bindings to be fully propogated
through the module tree before running execution functions. This separation of setting up bindings, and then running execution
allows us to match the exact ES module execution semantics.

This enables supporting the edge cases of for example:

a.js
```javascript
import {b} from './b.js';
export function a() {
  b();
}
```

b.js
```javascript
import {a} from './a.js';
export function b() {
  console.log('b');
}
a();
```

If a.js is imported first, then b.js will execute first. In ES module execution, b.js will successfully call the function export 
from a.js before a.js has even executed since function bindings are setup before execution. This is supported fully by 
the deferred loading step in this System.register approach.

It can be argued that this full support of ES module circular references is unnecessary. There is minimal additional performance
cost to this extra return statement though and it ensures that during the transition period where ES modules and traditional
environments are running side-by-side, that the best parity is provided between the systems.

#### Bulk exports

The `$__export` function above can also be used to export multiple exports at the same time:

```javascript
$__export({ key: 'value', another: 'value' });
```

This is useful for performance of deep re-exports where unnecessary setter operations can be avoided, otherwise setter performance
grows quadratically with the `export *` tree depth, and can cause noticable slowdowns on large trees.

#### Let and Uninitialized Bindings

Due to the hoisting of variable declarations into the outer scope, it is assumed that `let` or `const` should be converted into `var` statements. While TDZ errors are not maintained, the primary goal of the module format is that functional ES module code should be fully supported through System.register, and the converse that functional System.register code be functional ES module code is not a requirement of the format. As such, since functional ES module code should not have to rely on top-level TDZ errors for normal operation, this seems a suitable compromise for the format.

Top-level bindings that are uninitialized should still be exported with undefined values to ensure they contribute the module shape.

For example:

```js
export let x;
export function p () {
  x = 10;
}
```

Could be written:

```js
  System.register([], function($__export, $__moduleContext) {
    var x;
    function p() {
      x = 10;
    }
    $__export({
      x: undefined,
      p: p
    });
    return {
      // setters: [], // (setters can be optional when empty)
      execute: function() {
      }
    };
  });
```

Although in the case of not having any dependencies, it could be equally valid to omit hoisting entirely.

#### Metadata

The second argument to the `System.register` declare function is a context argument containing an `import` property for dynamic import support, as well as a `meta` property:

```js
console.log(import.meta.url);
import('./dynamic.js').then(function(m) {
  console.log(m);
});
```

could be written:

```js
  System.register([], function($__export, $__moduleContext) {
    return {
      execute: function() {
        console.log($__moduleContext.meta.url);
        $__moduleContext.import('./dynamic.js').then(function(m) {
          console.log(m);
        });
      }
    };
  });
```

#### Top-level await

Top-level await can be supported by returning a Promise from the `execute` function or making `execute` an asynchronous function.

This can fully support synchronous subgraph execution remaining synchronous while also allowing the runtime to support the exact loading semantics desired. Currently SystemJS supports variant B of the spec.

### Limitations

The main limitations with the format are the lack of TDZ for hosited bindings, as well as an inability to throw for non-existent bindings such as:

```javascript
import {p} from 'q';
```

Where module `q` does not export a `p` at all.

While this format can be adjusted to handle the SyntaxErrors that get thrown when an imported name does not exist, for performance and code-size constraints this is not provided. Ideally static checking via tooling should catch these issues rather.

Both of these cases allow code to run in the System.register output which would not work true ES module environments, which is seen as acceptable since the primary goal of the format is the converse - to ensure code which works in ES module environments can be fully supported in all functional cases in non ES module environments.
