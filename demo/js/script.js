/* 

Examples
Author: Addy Osmani

See: http://wiki.ecmascript.org/doku.php?id=harmony:module_loaders
for more information on the module loader proposal
*/


//Module: Define a new module
var module = new Module({test:'hello'});
console.log(module);

//System (pre-configured Loader)
System.import('js/test1.js', function(test1){
	console.log('test1.js loaded', test1);
	test1.tester();
});


// Loader: Define a new module loader instance
var baseURL = document.URL.substring(0, document.URL.lastIndexOf('\/') + 1);
var loader = new Loader({global: window,
    strict: false,
    resolve: function (name, options) {
      return  baseURL + name;
    }
  });

console.log(loader);

//Usage:

loader.import('js/test2.js',
    function(test) {
        console.log('test2.js loaded', test);
        test.foobar();
    }, function(err){
    	console.log(err);
	});



loader.import('js/libs/jquery-1.7.1.js',
    function() {
        console.log('jQuery loaded', loader.global.jQuery);
        loader.global.$('body').css({'background':'blue'});
    }, function(err){
    	console.log(err);
	});
