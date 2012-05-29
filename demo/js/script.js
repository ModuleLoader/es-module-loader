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
System.load('js/test1.js', function(test1){
	console.log('test1.js loaded', test1);
	test1.tester();
});


// Loader: Define a new module loader instance
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

//Usage:

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
