/*jshint forin:true, noarg:true, curly:false, eqeqeq:true, bitwise:true, undef:true, unused:true, browser:true, devel:true, bitwise:false, funcscope: true, maxerr:50 */
/* global self */

self.onmessage = (function() {
  "use strict";

  function uc(input, output, start, end) {
    var pos = 0;
    while (start < end) {
      var t = input[start++];

      var len = t >> 4;
      for (var l = len + 240; l === 255; len += l)
        l = input[start++];

      if (len !== 0)
        for (len += start; start !== len; output[pos++] = input[start++]) { }

      if (start >= end)
        break;

      var offset = input[start++] | (input[start++] << 8);
      if (offset === 0)
        return -(start - 2);

      len = t & 0xf;
      for (l = len + 240; l === 255; len += l)
        l = input[start++];

      len += pos + 4;
      for (var from = pos - offset; pos !== len; output[pos++] = output[from++]) { }
    }
    return pos;
  }

  function fix(data, len) {
    for (var i = 0; i < len; i += 4) {
      var temp = data[i];
      data[i] = data[i + 2];
      data[i + 2] = temp;
      data[i + 3] = 0xFF;
    }
  }

  function bulk(input, output) {
    var len = uc(input, output, 0, input.length);
    return len > 0 ? "" : "Bad data (" + (-len) + ")";
  }

  function image(input, output) {
    var len = uc(input, output, 6, input.length);
    if (len <= 0)
      return "Bad image (" + (-len) + ")";
    fix(output, len);
    return "";
  }

  // Ignore first message - used to check for transferable objects
  return function() {
    self.onmessage = function(e) {
      var data = e.data,
        input = new Uint8Array(data[0]),
        output = new Uint8Array(data[1]),
        handler = input[0] === 76 && input[1] === 90 ? image : bulk,
        error = handler(input, output);
      if (error)
        self.postMessage(error);
      else
        self.postMessage(data, data);
    };
  };
})();
