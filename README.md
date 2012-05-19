# es6-module-loader

An ES6 Module Loader shim

## Getting Started
### On the server
Install the module with: `npm install es6-module-loader`

```javascript
var es6_module_loader = require('es6-module-loader');
es6_module_loader.awesome(); // "awesome"
```

### In the browser
Download the [production version][min] or the [development version][max].

[min]: https://raw.github.com/addyosmani/es6-module-loader/master/dist/es6-module-loader.min.js
[max]: https://raw.github.com/addyosmani/es6-module-loader/master/dist/es6-module-loader.js

In your web page:

```html
<script src="dist/es6-module-loader.min.js"></script>
<script>
awesome(); // "awesome"
</script>
```

In your code, you can attach es6-module-loader's methods to any object.

```html
<script>
this.exports = Bocoup.utils;
</script>
<script src="dist/es6-module-loader.min.js"></script>
<script>
Bocoup.utils.awesome(); // "awesome"
</script>
```

## Documentation
_(Coming soon)_

## Examples
_(Coming soon)_

## Contributing
In lieu of a formal styleguide, take care to maintain the existing coding style. Add unit tests for any new or changed functionality. Lint and test your code using [grunt](https://github.com/cowboy/grunt).

_Also, please don't edit files in the "dist" subdirectory as they are generated via grunt. You'll find source code in the "lib" subdirectory!_

## Release History
_(Nothing yet)_

## License
Copyright (c) 2012 Luke Hogan, Addy Osmani  
Licensed under the MIT license.
