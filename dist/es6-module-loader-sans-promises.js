/*
 *  es6-module-loader v0.16.6
 *  https://github.com/ModuleLoader/es6-module-loader
 *  Copyright (c) 2015 Guy Bedford, Luke Hoban, Addy Osmani; Licensed MIT
 */

!function(__global){function __eval(__source,__global,__load){try{eval('(function() { var __moduleName = "'+(__load.name||"").replace('"','"')+'"; '+__source+" \n }).call(__global);")}catch(e){throw("SyntaxError"==e.name||"TypeError"==e.name)&&(e.message="Evaluating "+(__load.name||load.address)+"\n	"+e.message),e}}$__Object$getPrototypeOf=Object.getPrototypeOf||function(a){return a.__proto__};var $__Object$defineProperty;!function(){try{Object.defineProperty({},"a",{})&&($__Object$defineProperty=Object.defineProperty)}catch(a){$__Object$defineProperty=function(a,b,c){try{a[b]=c.value||c.get.call(a)}catch(d){}}}}(),$__Object$create=Object.create||function(a,b){function c(){}if(c.prototype=a,"object"==typeof b)for(prop in b)b.hasOwnProperty(prop)&&(c[prop]=b[prop]);return new c},function(){function a(a){return{status:"loading",name:a,linkSets:[],dependencies:[],metadata:{}}}function b(a,b,c){return new A(g({step:c.address?"fetch":"locate",loader:a,moduleName:b,moduleMetadata:c&&c.metadata||{},moduleSource:c.source,moduleAddress:c.address}))}function c(b,c,e,f){return new A(function(a){a(b.loaderObj.normalize(c,e,f))}).then(function(c){var e;if(b.modules[c])return e=a(c),e.status="linked",e.module=b.modules[c],e;for(var f=0,g=b.loads.length;g>f;f++)if(e=b.loads[f],e.name==c)return e;return e=a(c),b.loads.push(e),d(b,e),e})}function d(a,b){e(a,b,A.resolve().then(function(){return a.loaderObj.locate({name:b.name,metadata:b.metadata})}))}function e(a,b,c){f(a,b,c.then(function(c){return"loading"==b.status?(b.address=c,a.loaderObj.fetch({name:b.name,metadata:b.metadata,address:c})):void 0}))}function f(a,b,d){d.then(function(d){return"loading"==b.status?A.resolve(a.loaderObj.translate({name:b.name,metadata:b.metadata,address:b.address,source:d})).then(function(c){return b.source=c,a.loaderObj.instantiate({name:b.name,metadata:b.metadata,address:b.address,source:c})}).then(function(c){if(void 0===c)return b.address=b.address||"<Anonymous Module "+ ++D+">",b.isDeclarative=!0,a.loaderObj.transpile(b).then(function(a){var c=__global.System,d=c.register;c.register=function(a,c,d){"string"!=typeof a&&(d=c,c=a),b.declare=d,b.depsList=c},__eval(a,__global,b),c.register=d});if("object"!=typeof c)throw TypeError("Invalid instantiate return value");b.depsList=c.deps||[],b.execute=c.execute,b.isDeclarative=!1}).then(function(){b.dependencies=[];for(var d=b.depsList,e=[],f=0,g=d.length;g>f;f++)(function(d,f){e.push(c(a,d,b.name,b.address).then(function(a){if(b.dependencies[f]={key:d,value:a.name},"linked"!=a.status)for(var c=b.linkSets.concat([]),e=0,g=c.length;g>e;e++)i(c[e],a)}))})(d[f],f);return A.all(e)}).then(function(){b.status="loaded";for(var a=b.linkSets.concat([]),c=0,d=a.length;d>c;c++)k(a[c],b)}):void 0})["catch"](function(a){b.status="failed",b.exception=a;for(var c=b.linkSets.concat([]),d=0,e=c.length;e>d;d++)l(c[d],b,a)})}function g(b){return function(c){var g=b.loader,i=b.moduleName,j=b.step;if(g.modules[i])throw new TypeError('"'+i+'" already exists in the module table');for(var k,l=0,m=g.loads.length;m>l;l++)if(g.loads[l].name==i)return k=g.loads[l],"translate"!=j||k.source||(k.address=b.moduleAddress,f(g,k,A.resolve(b.moduleSource))),k.linkSets[0].done.then(function(){c(k)});var n=a(i);n.metadata=b.moduleMetadata;var o=h(g,n);g.loads.push(n),c(o.done),"locate"==j?d(g,n):"fetch"==j?e(g,n,A.resolve(b.moduleAddress)):(n.address=b.moduleAddress,f(g,n,A.resolve(b.moduleSource)))}}function h(a,b){var c={loader:a,loads:[],startingLoad:b,loadingCount:0};return c.done=new A(function(a,b){c.resolve=a,c.reject=b}),i(c,b),c}function i(a,b){for(var c=0,d=a.loads.length;d>c;c++)if(a.loads[c]==b)return;a.loads.push(b),b.linkSets.push(a),"loaded"!=b.status&&a.loadingCount++;for(var e=a.loader,c=0,d=b.dependencies.length;d>c;c++){var f=b.dependencies[c].value;if(!e.modules[f])for(var g=0,h=e.loads.length;h>g;g++)if(e.loads[g].name==f){i(a,e.loads[g]);break}}}function j(a){var b=!1;try{p(a,function(c,d){l(a,c,d),b=!0})}catch(c){l(a,null,c),b=!0}return b}function k(a,b){if(a.loadingCount--,!(a.loadingCount>0)){var c=a.startingLoad;if(a.loader.loaderObj.execute===!1){for(var d=[].concat(a.loads),e=0,f=d.length;f>e;e++){var b=d[e];b.module=b.isDeclarative?{name:b.name,module:E({}),evaluated:!0}:{module:E({})},b.status="linked",m(a.loader,b)}return a.resolve(c)}var g=j(a);g||a.resolve(c)}}function l(a,b,c){var d=a.loader;b&&a.loads[0].name!=b.name&&(c=w(c,'Error loading "'+b.name+'" from "'+a.loads[0].name+'" at '+(a.loads[0].address||"<unknown>")+"\n")),b&&(c=w(c,'Error loading "'+b.name+'" at '+(b.address||"<unknown>")+"\n"));for(var e=a.loads.concat([]),f=0,g=e.length;g>f;f++){var b=e[f];d.loaderObj.failed=d.loaderObj.failed||[],-1==B.call(d.loaderObj.failed,b)&&d.loaderObj.failed.push(b);var h=B.call(b.linkSets,a);if(b.linkSets.splice(h,1),0==b.linkSets.length){var i=B.call(a.loader.loads,b);-1!=i&&a.loader.loads.splice(i,1)}}a.reject(c)}function m(a,b){if(a.loaderObj.trace){a.loaderObj.loads||(a.loaderObj.loads={});var c={};b.dependencies.forEach(function(a){c[a.key]=a.value}),a.loaderObj.loads[b.name]={name:b.name,deps:b.dependencies.map(function(a){return a.key}),depMap:c,address:b.address,metadata:b.metadata,source:b.source,kind:b.isDeclarative?"declarative":"dynamic"}}b.name&&(a.modules[b.name]=b.module);var d=B.call(a.loads,b);-1!=d&&a.loads.splice(d,1);for(var e=0,f=b.linkSets.length;f>e;e++)d=B.call(b.linkSets[e].loads,b),-1!=d&&b.linkSets[e].loads.splice(d,1);b.linkSets.splice(0,b.linkSets.length)}function n(a,b,c){if(c[a.groupIndex]=c[a.groupIndex]||[],-1==B.call(c[a.groupIndex],a)){c[a.groupIndex].push(a);for(var d=0,e=b.length;e>d;d++)for(var f=b[d],g=0;g<a.dependencies.length;g++)if(f.name==a.dependencies[g].value){var h=a.groupIndex+(f.isDeclarative!=a.isDeclarative);if(void 0===f.groupIndex||f.groupIndex<h){if(void 0!==f.groupIndex&&(c[f.groupIndex].splice(B.call(c[f.groupIndex],f),1),0==c[f.groupIndex].length))throw new TypeError("Mixed dependency cycle detected");f.groupIndex=h}n(f,b,c)}}}function o(a,b,c){try{var d=b.execute()}catch(e){return void c(b,e)}return d&&d instanceof y?d:void c(b,new TypeError("Execution must define a Module instance"))}function p(a,b){var c=a.loader;if(a.loads.length){var d=[],e=a.loads[0];e.groupIndex=0,n(e,a.loads,d);for(var f=e.isDeclarative==d.length%2,g=d.length-1;g>=0;g--){for(var h=d[g],i=0;i<h.length;i++){var j=h[i];if(f)r(j,a.loads,c);else{var k=o(a,j,b);if(!k)return;j.module={name:j.name,module:k},j.status="linked"}m(c,j)}f=!f}}}function q(a,b){var c=b.moduleRecords;return c[a]||(c[a]={name:a,dependencies:[],module:new y,importers:[]})}function r(a,b,c){if(!a.module){var d=a.module=q(a.name,c),e=a.module.module,f=a.declare.call(__global,function(a,b){d.locked=!0,e[a]=b;for(var c=0,f=d.importers.length;f>c;c++){var g=d.importers[c];if(!g.locked)for(var h=0;h<g.dependencies.length;++h)g.dependencies[h]===d&&g.setters[h](e)}return d.locked=!1,b});d.setters=f.setters,d.execute=f.execute;for(var g=0,h=a.dependencies.length;h>g;g++){var i=a.dependencies[g].value,j=c.modules[i];if(!j)for(var k=0;k<b.length;k++)b[k].name==i&&(b[k].module?j=q(i,c):(r(b[k],b,c),j=b[k].module));j.importers?(d.dependencies.push(j),j.importers.push(d)):d.dependencies.push(null),d.setters[g]&&d.setters[g](j.module)}a.status="linked"}}function s(a,b){return u(b.module,[],a),b.module.module}function t(a){try{a.execute.call(__global)}catch(b){return b}}function u(a,b,c){var d=v(a,b,c);if(d)throw d}function v(a,b,c){if(!a.evaluated&&a.dependencies){b.push(a);for(var d,e=a.dependencies,f=0,g=e.length;g>f;f++){var h=e[f];if(h&&-1==B.call(b,h)&&(d=v(h,b,c)))return d=w(d,"Error evaluating "+h.name+"\n")}if(a.failed)return new Error("Module failed execution.");if(!a.evaluated)return a.evaluated=!0,d=t(a),d?a.failed=!0:Object.preventExtensions&&Object.preventExtensions(a.module),a.execute=void 0,d}}function w(a,b){return a instanceof Error?a.message=b+a.message:a=b+a,a}function x(a){if("object"!=typeof a)throw new TypeError("Options must be an object");a.normalize&&(this.normalize=a.normalize),a.locate&&(this.locate=a.locate),a.fetch&&(this.fetch=a.fetch),a.translate&&(this.translate=a.translate),a.instantiate&&(this.instantiate=a.instantiate),this._loader={loaderObj:this,loads:[],modules:{},importPromises:{},moduleRecords:{}},C(this,"global",{get:function(){return __global}})}function y(){}function z(a,b,c){var d=a._loader.importPromises;return d[b]=c.then(function(a){return d[b]=void 0,a},function(a){throw d[b]=void 0,a})}var A=__global.Promise||require("when/es6-shim/Promise");__global.console&&(console.assert=console.assert||function(){});var B=Array.prototype.indexOf||function(a){for(var b=0,c=this.length;c>b;b++)if(this[b]===a)return b;return-1},C=$__Object$defineProperty,D=0;x.prototype={constructor:x,define:function(a,b,c){if(this._loader.importPromises[a])throw new TypeError("Module is already loading.");return z(this,a,new A(g({step:"translate",loader:this._loader,moduleName:a,moduleMetadata:c&&c.metadata||{},moduleSource:b,moduleAddress:c&&c.address})))},"delete":function(a){var b=this._loader;return delete b.importPromises[a],delete b.moduleRecords[a],b.modules[a]?delete b.modules[a]:!1},get:function(a){return this._loader.modules[a]?(u(this._loader.modules[a],[],this),this._loader.modules[a].module):void 0},has:function(a){return!!this._loader.modules[a]},"import":function(a,c){var d=this;return A.resolve(d.normalize(a,c&&c.name,c&&c.address)).then(function(a){var e=d._loader;return e.modules[a]?(u(e.modules[a],[],e._loader),e.modules[a].module):e.importPromises[a]||z(d,a,b(e,a,c||{}).then(function(b){return delete e.importPromises[a],s(e,b)}))})},load:function(a){return this._loader.modules[a]?(u(this._loader.modules[a],[],this._loader),A.resolve(this._loader.modules[a].module)):this._loader.importPromises[a]||z(this,a,b(this._loader,a,{}))},module:function(b,c){var d=a();d.address=c&&c.address;var e=h(this._loader,d),g=A.resolve(b),i=this._loader,j=e.done.then(function(){return s(i,d)});return f(i,d,g),j},newModule:function(a){if("object"!=typeof a)throw new TypeError("Expected object");var b,c=new y;if(Object.getOwnPropertyNames&&null!=a)b=Object.getOwnPropertyNames(a);else{b=[];for(var d in a)b.push(d)}for(var e=0;e<b.length;e++)(function(b){C(c,b,{configurable:!1,enumerable:!0,get:function(){return a[b]}})})(b[e]);return Object.preventExtensions&&Object.preventExtensions(c),c},set:function(a,b){if(!(b instanceof y))throw new TypeError("Loader.set("+a+", module) must be a module");this._loader.modules[a]={module:b}},normalize:function(a){return a},locate:function(a){return a.name},fetch:function(){throw new TypeError("Fetch not implemented")},translate:function(a){return a.source},instantiate:function(){}};var E=x.prototype.newModule;"object"==typeof exports&&(module.exports=x),__global.Reflect=__global.Reflect||{},__global.Reflect.Loader=__global.Reflect.Loader||x,__global.Reflect.global=__global.Reflect.global||__global,__global.LoaderPolyfill=x}(),function(a){function b(a,b){return a.newModule({"default":g[b],__useDefault:!0})}function c(a,b){var c=this.traceurOptions||{};c.modules="instantiate",c.script=!1,c.sourceMaps="inline",c.filename=a.address,c.inputSourceMap=a.metadata.sourceMap,c.moduleName=!1;var e=new b.Compiler(c),f=d(a.source,e,c.filename);return f+"\n//# sourceURL="+a.address+"!eval"}function d(a,b,c){try{return b.compile(a,c)}catch(d){throw d[0]}}function e(a,b){var c=this.babelOptions||{};c.modules="system",c.sourceMap="inline",c.filename=a.address,c.code=!0,c.ast=!1,c.blacklist||(c.blacklist=["react"]);var d=b.transform(a.source,c).code;return d+"\n//# sourceURL="+a.address+"!eval"}function f(a,b){var c=this.typescriptOptions||{};c.module=b.ModuleKind.System,c.target=b.ScriptTarget.ES5,c.inlineSourceMap=!0,c.inlineSources=!0;var d=b.transpile(a.source,c);return d+"\n//# sourceURL="+a.address+"!eval"}var g=__global;a.prototype.transpiler="traceur",a.prototype.transpile=function(a){var d=this;return d.transpilerHasRun||(g.traceur&&!d.has("traceur")&&d.set("traceur",b(d,"traceur")),g.babel&&!d.has("babel")&&d.set("babel",b(d,"babel")),g.ts&&!d.has("typescript")&&d.set("typescript",b(d,"ts")),d.transpilerHasRun=!0),d["import"](d.transpiler).then(function(b){b.__useDefault&&(b=b["default"]);var g;return g=b.Compiler?c:b.createLanguageService?f:e,'var __moduleAddress = "'+a.address+'";'+g.call(d,a,b)})},a.prototype.instantiate=function(a){var c=this;return Promise.resolve(c.normalize(c.transpiler)).then(function(d){return a.name===d?{deps:[],execute:function(){var d=g.System,e=g.Reflect.Loader;return __eval("(function(require,exports,module){"+a.source+"})();",g,a),g.System=d,g.Reflect.Loader=e,b(c,a.name)}}:void 0})}}(__global.LoaderPolyfill);var $__Object$getPrototypeOf=Object.getPrototypeOf,$__Object$defineProperty=Object.defineProperty,$__Object$create=Object.create;!function(){function a(a){var b=String(a).replace(/^\s+|\s+$/g,"").match(/^([^:\/?#]+:)?(\/\/(?:[^:@\/?#]*(?::[^:@\/?#]*)?@)?(([^:\/?#]*)(?::(\d*))?))?([^?#]*)(\?[^#]*)?(#[\s\S]*)?/);return b?{href:b[0]||"",protocol:b[1]||"",authority:b[2]||"",host:b[3]||"",hostname:b[4]||"",port:b[5]||"",pathname:b[6]||"",search:b[7]||"",hash:b[8]||""}:null}function b(a){var b=[];return a.replace(/^(\.\.?(\/|$))+/,"").replace(/\/(\.(\/|$))+/g,"/").replace(/\/\.\.$/,"/../").replace(/\/?[^\/]*/g,function(a){"/.."===a?b.pop():b.push(a)}),b.join("").replace(/^\//,"/"===a.charAt(0)?"/":"")}function c(c,d){return h&&(d=d.replace(/\\/g,"/")),d=a(d||""),c=a(c||""),d&&c?(d.protocol||c.protocol)+(d.protocol||d.authority?d.authority:c.authority)+b(d.protocol||d.authority||"/"===d.pathname.charAt(0)?d.pathname:d.pathname?(c.authority&&!c.pathname?"/":"")+c.pathname.slice(0,c.pathname.lastIndexOf("/")+1)+d.pathname:c.pathname)+(d.protocol||d.authority||d.pathname?d.search:d.search||c.search)+d.hash:null}function d(){document.removeEventListener("DOMContentLoaded",d,!1),window.removeEventListener("load",d,!1),e()}function e(){for(var a=document.getElementsByTagName("script"),b=0;b<a.length;b++){var c=a[b];if("module"==c.type){var d=c.innerHTML.substr(1);__global.System.module(d)["catch"](function(a){setTimeout(function(){throw a})})}}}var f,g="undefined"!=typeof window&&"undefined"!=typeof document,h="undefined"!=typeof process&&!!process.platform.match(/^win/),i=__global.Promise||require("when/es6-shim/Promise");if("undefined"!=typeof XMLHttpRequest)f=function(a,b,c){function d(){b(f.responseText)}function e(){c(f.statusText+": "+a||"XHR error")}var f=new XMLHttpRequest,g=!0,h=!1;if(!("withCredentials"in f)){var i=/^(\w+:)?\/\/([^\/]+)/.exec(a);i&&(g=i[2]===window.location.host,i[1]&&(g&=i[1]===window.location.protocol))}g||"undefined"==typeof XDomainRequest||(f=new XDomainRequest,f.onload=d,f.onerror=e,f.ontimeout=e,f.onprogress=function(){},f.timeout=0,h=!0),f.onreadystatechange=function(){4===f.readyState&&(200===f.status||0==f.status&&f.responseText?d():e())},f.open("GET",a,!0),h&&setTimeout(function(){f.send()},0),f.send(null)};else{if("undefined"==typeof require)throw new TypeError("No environment fetch API available.");var j;f=function(a,b,c){if("file:"!=a.substr(0,5))throw"Only file URLs of the form file: allowed running in Node.";return j=j||require("fs"),a=a.substr(5),h&&(a=a.replace(/\//g,"\\")),j.readFile(a,function(a,d){return a?c(a):void b(d+"")})}}var k=function(a){function b(b){if(a.call(this,b||{}),"undefined"!=typeof location&&location.href){var c=__global.location.href.split("#")[0].split("?")[0];this.baseURL=c.substring(0,c.lastIndexOf("/")+1)}else{if("undefined"==typeof process||!process.cwd)throw new TypeError("No environment baseURL");this.baseURL="file:"+process.cwd()+"/",h&&(this.baseURL=this.baseURL.replace(/\\/g,"/"))}this.paths={"*":"*.js"}}return b.__proto__=null!==a?a:Function.prototype,b.prototype=$__Object$create(null!==a?a.prototype:null),$__Object$defineProperty(b.prototype,"constructor",{value:b}),$__Object$defineProperty(b.prototype,"global",{get:function(){return __global},enumerable:!1}),$__Object$defineProperty(b.prototype,"strict",{get:function(){return!0},enumerable:!1}),$__Object$defineProperty(b.prototype,"normalize",{value:function(a,b){if("string"!=typeof a)throw new TypeError("Module name must be a string");var c=a.split("/");if(0==c.length)throw new TypeError("No module name provided");var d=0,e=!1,f=0;if("."==c[0]){if(d++,d==c.length)throw new TypeError('Illegal module name "'+a+'"');e=!0}else{for(;".."==c[d];)if(d++,d==c.length)throw new TypeError('Illegal module name "'+a+'"');d&&(e=!0),f=d}for(var g=d;g<c.length;g++){var h=c[g];if(""==h||"."==h||".."==h)throw new TypeError('Illegal module name "'+a+'"')}if(!e)return a;{var i=[],j=(b||"").split("/");j.length-1-f}return i=i.concat(j.splice(0,j.length-1-f)),i=i.concat(c.splice(d,c.length-d)),i.join("/")},enumerable:!1,writable:!0}),$__Object$defineProperty(b.prototype,"locate",{value:function(a){var b,d=a.name,e="";for(var f in this.paths){var h=f.split("*");if(h.length>2)throw new TypeError("Only one wildcard in a path is permitted");if(1==h.length){if(d==f&&f.length>e.length){e=f;break}}else d.substr(0,h[0].length)==h[0]&&d.substr(d.length-h[1].length)==h[1]&&(e=f,b=d.substr(h[0].length,d.length-h[1].length-h[0].length))}var i=this.paths[e];return b&&(i=i.replace("*",b)),g&&(i=i.replace(/#/g,"%23")),c(this.baseURL,i)},enumerable:!1,writable:!0}),$__Object$defineProperty(b.prototype,"fetch",{value:function(a){var b=this;return new i(function(d,e){f(c(b.baseURL,a.address),function(a){d(a)},e)})},enumerable:!1,writable:!0}),b}(__global.LoaderPolyfill),l=new k;if("object"==typeof exports&&(module.exports=l),__global.System=l,g&&document.getElementsByTagName){var m=document.getElementsByTagName("script");m=m[m.length-1],"complete"===document.readyState?setTimeout(e):document.addEventListener&&(document.addEventListener("DOMContentLoaded",d,!1),window.addEventListener("load",d,!1)),m.getAttribute("data-init")&&window[m.getAttribute("data-init")]()}}()}("undefined"!=typeof window?window:"undefined"!=typeof global?global:self);
//# sourceMappingURL=es6-module-loader-sans-promises.js.map