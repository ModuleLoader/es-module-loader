import { isNode } from './common.js';

/*
 * Optimized URL normalization assuming a syntax-valid URL parent
 */ 
export function resolveUrlToParentIfNotPlain(relUrl, parentUrl) {

  function throwResolveError() {
    throw new RangeError('Unable to resolve "' + relUrl + '" to ' + parentUrl);
  }

  var protocolIndex = relUrl.indexOf(':');
  if (protocolIndex !== -1) {
    if (isNode) {
      // Windows filepath compatibility (unique to SystemJS, not in URL spec at all)
      // C:\x becomes file:///c:/x (we don't support C|\x)
      if (relUrl[1] === ':' && relUrl[2] === '\\' && relUrl[0].match(/a-z/i) && parentUrl.substr(0, 5) === 'file:')
        return 'file:///' + relUrl.replace(/\\/g, '/');
    }
    return relUrl;
  }

  var parentProtocol = parentUrl.substr(0, parentUrl.indexOf(':') + 1);

  // protocol-relative
  if (relUrl[0] === '/' && relUrl[1] === '/') {
    if (!parentProtocol)
      throwResolveError();
    return parentProtocol + relUrl;
  }
  // relative-url
  else if (relUrl[0] === '.' && (relUrl[1] === '/' || relUrl[1] === '.' && relUrl[2] === '/') || relUrl[0] === '/') {
    var parentIsURL = !!parentProtocol;

    // invalid form to accept an authority state -> cannot relative resolve (eg dataURI)
    // (if parent URL is actually missing the // when expected then that is an input error for this function)
    if (parentIsURL && (parentUrl[parentProtocol.length] !== '/' || parentUrl[parentProtocol.length + 1] !== '/'))
      throwResolveError();

    // read pathname from parent
    var pathname = parentIsURL ? parentUrl.substr(parentProtocol.length + 2) : parentUrl;
    // parse out auth and host
    if (parentProtocol !== 'file:')
      pathname = pathname.substr(pathname.indexOf('/'));

    if (relUrl[0] === '/')
      return parentUrl.substr(0, parentUrl.length - pathname.length) + relUrl;
    
    // join together and split for removal of .. and . segments
    // looping the string instead of anything fancy for perf reasons
    // '../../../../../z' resolved to 'x/y' is just 'z' regardless of parentIsURL
    var segmented = pathname.substr(0, pathname.lastIndexOf('/') + 1) + relUrl;
    var output = [];
    var segmentIndex = undefined;
    for (var i = 0; i < segmented.length; i++) {
      if (segmentIndex !== undefined) {
        if (segmented[i] === '/') {
          output.push(segmented.substr(segmentIndex, i - segmentIndex));
          segmentIndex = undefined;
        }
      }
      else if (segmented[i] === '.') {
        // ../ segment
        if (segmented[i + 1] === '.' && segmented[i + 2] === '/') {
          output.pop();
          i += 2;
        }
        // ./ segment
        else if (segmented[i + 1] === '/') {
          i += 1;
        }
      }
      // standard character
      else {
        segmentIndex = i;
      }
    }
    if (segmentIndex !== undefined)
      output.push(segmented.substr(segmentIndex, i - segmentIndex));
    
    return parentUrl.substr(0, parentUrl.length - pathname.length) + output.join('/');
  }
  
  // plain name -> return undefined
}