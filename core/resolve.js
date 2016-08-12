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
      if (relUrl[1] === ':' && relUrl[2] === '\\' && relUrl[0].match(/[a-z]/i) && parentUrl.substr(0, 5) === 'file:')
        return 'file:///' + relUrl.replace(/\\/g, '/');
    }
    return relUrl;
  }

  var parentProtocol = parentUrl && parentUrl.substr(0, parentUrl.indexOf(':') + 1);

  // protocol-relative
  if (relUrl[0] === '/' && relUrl[1] === '/') {
    if (!parentProtocol)
      throwResolveError();
    return parentProtocol + relUrl;
  }
  // relative-url
  else if (relUrl[0] === '.' && (relUrl[1] === '/' || relUrl[1] === '.' && (relUrl[2] === '/' || relUrl.length === 2) || relUrl.length === 1)
      || relUrl[0] === '/') {
    var parentIsPlain = !parentProtocol || parentUrl[parentProtocol.length] !== '/';

    // read pathname from parent if a URL
    // pathname taken to be part after leading "/"
    var pathname;
    if (parentIsPlain) {
      // resolving to a plain parent -> skip standard URL prefix, and treat entire parent as pathname
      if (parentUrl === undefined)
        throwResolveError();
      pathname = parentUrl;
    }
    else if (parentUrl[parentProtocol.length + 1] === '/') {
      // resolving to a :// so we need to read out the auth and host
      if (parentProtocol !== 'file:') {
        pathname = parentUrl.substr(parentProtocol.length + 2);
        pathname = pathname.substr(pathname.indexOf('/') + 1);
      }
      else {
        pathname = parentUrl.substr(8);
      }
    }
    else {
      // resolving to :/ so pathname is the /... part
      pathname = parentUrl.substr(parentProtocol.length + 1);
    }

    if (relUrl[0] === '/') {
      if (parentIsPlain)
        throwResolveError();
      else
        return parentUrl.substr(0, parentUrl.length - pathname.length - 1) + relUrl;
    }
    
    // join together and split for removal of .. and . segments
    // looping the string instead of anything fancy for perf reasons
    // '../../../../../z' resolved to 'x/y' is just 'z' regardless of parentIsPlain
    var segmented = pathname.substr(0, pathname.lastIndexOf('/') + 1) + relUrl;

    var output = [];
    var segmentIndex = undefined;

    for (var i = 0; i < segmented.length; i++) {
      // busy reading a segment - only terminate on '/'
      if (segmentIndex !== undefined) {
        if (segmented[i] === '/') {
          output.push(segmented.substr(segmentIndex, i - segmentIndex + 1));
          segmentIndex = undefined;
        }
        continue;
      }

      // new segment - check if it is relative
      if (segmented[i] === '.') {
        // ../ segment
        if (segmented[i + 1] === '.' && (segmented[i + 2] === '/' || i === segmented.length - 2)) {
          output.pop();
          i += 2;
        }
        // ./ segment
        else if (segmented[i + 1] === '/' || i === segmented.length - 1) {
          i += 1;
        }
        else {
          // the start of a new segment as below
          segmentIndex = i;
          continue;
        }

        // this is the plain URI backtracking error (../, package:x -> error)
        if (parentIsPlain && output.length === 0)
          throwResolveError();
        
        // trailing . or .. segment
        if (i === segmented.length)
          output.push('');
        continue;
      }

      // it is the start of a new segment
      segmentIndex = i;
    }
    // finish reading out the last segment
    if (segmentIndex !== undefined)
      output.push(segmented.substr(segmentIndex, segmented.length - segmentIndex));
    
    return parentUrl.substr(0, parentUrl.length - pathname.length) + output.join('');
  }
  
  // plain name -> return undefined
}