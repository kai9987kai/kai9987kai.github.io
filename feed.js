(function() {
    // Loader
    var loader = new function() {
        this.rC = -1, this.r = [], this.add = function(t) {
            this.r.push(t)
        }, this.addTag = function(t, e) {
            var i = document.getElementsByTagName("head")[0],
                s = t.indexOf(".js") > 0 ? "script" : "link",
                n = document.createElement(s);
            i.appendChild(n), n.onload = e, n.charset = "UTF-8", "script" === s ? (n.type = "text/javascript", n.src = t) : "link" === s && (n.rel = "stylesheet", n.href = t)
        }, this.loadNext = function() {
            if (this.rC++, this.rC >= this.r.length) this.done();
            else {
                var t = this.r[this.rC];
                this.addTag(t, this.loadNext.bind(this))
            }
        }, this.done = function() {
            this.onResourcesLoaded(window.Curator)
        }, this.load = function(t) {
            this.onResourcesLoaded = t, this.loadNext()
        }
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
        "hidePoweredBy": false,
        "embedSource": "",
        "forceHttps": false,
        "feed": {
            "id": "80c8fd55-b87e-4f36-bcd6-f46491027d5b",
            "apiEndpoint": "https:\/\/api.curator.io",
            "postsPerPage": 12,
            "params": {
                "exclude_screen_name": "curator_io"
            },
            "limit": 25
        },
        "popup": {
            "template": "popup",
            "templateWrapper": "popup-wrapper",
            "autoPlayVideos": false,
            "deepLink": false
        },
        "filter": {
            "template": "filter",
            "showNetworks": false,
            "showSources": false,
            "showAll": false,
            "default": "all",
            "limitPosts": false,
            "limitPostNumber": 0,
            "period": ""
        },
        "type": "Waterfall",
        "theme": "sydney"
    };
    var colours = {
        "widgetBgColor": "transparent",
        "bgColor": "#ffffff",
        "borderColor": "#cccccc",
        "iconColor": "#222222",
        "textColor": "#222222",
        "linkColor": "#999999",
        "dateColor": "#000000",
        "footerColor": "#ffffff",
        "tabIndexColor": "#cccccc"
    };
    var styles = {};

    // Bootstrap
    function loaderCallback() {
        window.Curator.load
        window.Curator.loadWidget(config, colours, styles);

    }

    // Run Loader
    loader.add('https://cdn.curator.io/5.0/curator.embed.css');
    loader.add('https://cdn.curator.io/published-css/80c8fd55-b87e-4f36-bcd6-f46491027d5b.css');

    loader.add('https://cdn.curator.io/5.0/curator.embed.js');

    loader.load(loaderCallback);
})();
