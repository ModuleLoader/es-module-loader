### Moving to Production

When in production, it is not suitable to load ES6 modules and syntax in the browser.

#### System.register Output

There is a `modules=instantiate` build output in Traceur and `modules=system` output in Babel that can be used with the ES6 Module Loader, provided it has the [System.register extension](https://github.com/systemjs/systemjs/blob/master/lib/extension-register.js)
from [SystemJS](https://github.com/systemjs/systemjs).

The benefit of this output is that it provides full support for circular references and live module bindings.

[This output format is explained here](system-register.md)

A basic example of using this extension with a Traceur build would be the following (although the related similar workflow would apply for Babel):

1. Build all ES6 modules into ES5 System.register form:

  ```
    traceur --out app-build.js app/app.js --modules=instantiate
  ```

2. If using additional ES6 features apart from modules syntax, load [`traceur-runtime.js`](https://raw.githubusercontent.com/jmcriffey/bower-traceur-runtime/0.0.79/traceur-runtime.js) (also included in the `bin` folder when installing Traceur through Bower or npm). Then include `es6-module-loader.js` and then apply the register extension before doing the import or loading the bundle as a script:

  ```html
    <script src="traceur-runtime.js"></script>
    <script src="es6-module-loader.js"></script>
    <script>
      /*
       * This should be a separate external script
       * Register function is included from https://github.com/systemjs/systemjs/blob/master/lib/extension-register.js
       */
      function register(loader) { 
        // ...
      }

      // this needs to be added to apply the extension
      register(System);
    </script>

    <!-- now include the bundle -->
    <script src="app-build.js"></script>

    <!-- now we can import and get modules from the bundle -->
    <script>
      System.import('app/app');
    </script>
  ```

* Note that `app-build.js` must be at the base-level for this to work.
* Also, the name we import, `app/app` must be the same name given to Traceur's compiler.

#### Building into separate files

We can also build separate files with:

```
  traceur --dir app app-build --modules=instantiate
```

With the above, we can load from the separate files identical to loading ES6.

#### Building across module formats

If using a loader like [SystemJS](https://github.com/systemjs/systemjs) to load different module formats, then a build can also be performed across module formats as well.

See [SystemJS builder](https://github.com/systemjs/builder) for this combined approach.