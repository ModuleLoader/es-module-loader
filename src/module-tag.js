  // <script type="module"> support
  // allow a data-init function callback once loaded
  if (typeof document != 'undefined' && document.getElementsByTagName) {
    var curScript = document.getElementsByTagName('script');
    curScript = curScript[curScript.length - 1];

    function completed() {
      document.removeEventListener('DOMContentLoaded', completed, false );
      window.removeEventListener('load', completed, false );
      ready();
    }

    function ready() {
      var scripts = document.getElementsByTagName('script');
      var anonCnt = 0;
      for (var i = 0; i < scripts.length; i++) {
        var script = scripts[i];
        if (script.type == 'module') {
          var url = script.src;

          // <script type="module" src="file.js"></script>
          if (url) {
            System.load(url, 'ready');
          }

          // <script type="module">import "x"</script>
          else {
            System.provide('anon' + ++anonCnt, 'fetch', script.innerHTML.substr(1));
            System.load('anon' + anonCnt, 'ready');
          }
        }
      }
    }

    // DOM ready, taken from https://github.com/jquery/jquery/blob/master/src/core/ready.js#L63
    if (document.readyState === 'complete') {
      setTimeout(ready);
    }
    else if (document.addEventListener) {
      document.addEventListener('DOMContentLoaded', completed, false);
      window.addEventListener('load', completed, false);
    }

    // run the data-init function on the script tag
    if (curScript && curScript.getAttribute('data-init'))
      window[curScript.getAttribute('data-init')]();
  }