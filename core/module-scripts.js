// <script type="module"> support
export function loadModuleScripts(loader) {
  if (typeof document != 'undefined' && document.getElementsByTagName) {
    function ready() {
      document.removeEventListener('DOMContentLoaded', completed, false );

      var anonCnt = 0;

      var scripts = document.getElementsByTagName('script');
      for (var i = 0; i < scripts.length; i++) {
        var script = scripts[i];
        if (script.type == 'module' && !script.loaded) {
          script.loaded = true;
          if (script.src)
            loader.import(script.src);

          // anonymuos modules supported by a loader ".module" interface
          else if (loader.define)
            loader.define('anon' + ++anonCnt, script.innerHTML);
        }
      }
    }

    // simple DOM ready
    if (document.readyState === 'complete')
      setTimeout(ready);
    else
      document.addEventListener('DOMContentLoaded', ready, false);
  }
}