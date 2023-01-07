(function() {
  // Loader
  var loader = new
  function() {
    this.rC = -1;
    this.r = [];
    this.add = function(t) {
      this.r.push(t);
    };
    this.addTag = function(t, e) {
      var i = document.getElementsByTagName("head")[0];
      var s = t.indexOf(".js") > 0 ? "script": "link";
      var n = document.createElement(s);
      i.appendChild(n);
      n.onload = e;
      n.charset = "UTF-8";
      if (s === "script") {
        n.type = "text/javascript";
        n.src = t;
      } else if (s === "link") {
        n.rel = "stylesheet";
        n.href = t;
      }
    };
    this.loadNext = function() {
      if (this.rC++, this.rC >= this.r.length) {
        this.done();
      } else {
        var t = this.r[this.rC];
        this.addTag(t, this.loadNext.bind(this));
      }
    };
    this.done = function() {
      this.onResourcesLoaded(window.Curator);
    };
    this.load = function(t) {
      this.onResourcesLoaded = t;
      this.loadNext();
    };
  };

  // Config
  var config = {
    "post": {
      "animate": true,
      "maxHeight": 0,
      "showTitles": true,
      "showShare": true,
      "showComments": false,
      "showLikes": false,
      "autoPlayVideos": false,
      "clickAction": "open-popup",
      "clickReadMoreAction": "open-popup",
      "maxLines": 0
    },
    "widget": {
      "template": "widget-waterfall",
      "colWidth": 250,
      "colGutter": 0,
      "showLoadMore": true,
      "continuousScroll": false,
      "postsPerPage": 12,
      "animate": false,
      "progressiveLoad": false,
      "lazyLoad": false,
      "verticalSpacing": 20,
      "horizontalSpacing": 20,
      "autoLoadNew": false,
      "lazyLoadType": "none",
      "gridMobile": false
    },
    "lang": "en",
    "container": "#curator-feed-default-feed-layout",
    "debug": 0,
    "hidePoweredBy": true,
    "embedSource": "",
    "forceHttps": false,
    "feed": {
      "id": "80c8fd55-b87e-4f36-bcd6-f46491027d5b",
      -footer > p,
      .curator - feed - item - footer > img ');
if (poweredByCuratorElements.length) {
// If the "Powered by Curator.io" text or image is present, remove it from the widget
poweredByCuratorElements.forEach(function(element) {
element.parentNode.removeChild(element);
});
}
}

// Run Loader
loader.add('
      https: //cdn.curator.io/5.0/curator.embed.css');
      loader.add('https://cdn.curator.io/published-css/80c8fd55-b87e-4f36-bcd6-f46491027d5b.css');
      loader.add('https://cdn.curator.io/5.0/curator.embed.js');
      loader.load(loaderCallback);
    })();
