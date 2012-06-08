(function ($, window) {

  var flashPath = "flash/bin-debug/FlashVideo.swf";
  var funcs = ["play", "pause", "stop", "currentTime", "duration", "setVolume", "volume", "ready"];
  var techOrder = ["html", "flash"];
  var tech = {};

  // EventEmitter starts

  var EventEmitter = function () {
    this.listeners = {};
  };

  EventEmitter.prototype = {
    on: function (type, callback) {
      this.listeners[type] = this.listeners[type] || [];
      this.listeners[type].push(callback);
    },
    once: function (type, callback) {
      var self = this;
      this.on(type, function () {
        var args = Array.prototype.slice.call(arguments);
        callback.apply(self, args);
        self.removeEventListener(type, callback);
      });
    },
    emit: function () {
      var args = Array.prototype.slice.call(arguments);
      var type = args.shift();

      var cbs = this.listeners[type] || [];

      for (var i = 0; i < cbs.length; i++) {
        var fn = cbs[i];
        fn.apply(self, args);
      }
    },
    removeEventListener: function (type, callback) {
      if (!this.listeners[type]) {
        return;
      }

      if (callback) {
        var cbs = this.listeners[type];
        for (var i = 0; i < cbs.length; i++) {
          if (cbs[i] == callback) {
            cbs.slice(i, 1);
            return;
          }
        }
      } else {
        this.listeners[type] = [];
      }
    }
  };

  // EventEmitter ends

  // Flash tech start

  var idIncr = 0;

  var FlashTech = function (player) {
    var self = this;

    EventEmitter.call(this); // Call eventemitter constructor

    this.player = player;

    var jsApiCallback = "html5video_" + (new Date()).getTime() + "_" + idIncr;

    window[jsApiCallback] = function (type, data) {
      self.emit(type, data);
    };

    var swfContent = $.flash.create({
      width: this.player.options.width,
      height: this.player.options.height,
      wmode: 'opaque',
      bgcolor: '000000',
      allowScriptAccess: 'always',
      swf: flashPath,
      flashvars: {
        jsApiCallback: "window." + jsApiCallback,
        fileUrl: this.player.options.url,
        autoplay: !!(this.player.options.autoplay)
      }
    });

    var element = $(swfContent);
    this.swf = element[0];
    $(this.player.element).append(element);
  };

  FlashTech.prototype = new EventEmitter(); // Inherit event emitter

  FlashTech.canPlayType = function (type) {
    return type === "video/mp4";
  };

  FlashTech.prototype.ready = function (callback) {
    if (this.swf.v_isReady && this.swf.v_isReady()) {
      callback.call(this);
    } else {
      this.once('ready', callback);
    }
  };

  $.each(funcs, function (indx, key) {
    if (key == "ready") { // ready is not generic
      return;
    }
    FlashTech.prototype[key] = function () {
      var args = Array.prototype.slice.call(arguments);
      return this.swf["v_" + key].apply(this.swf, args);
    }
  });

  tech['flash'] = FlashTech;

  // Flash tech ends

  // Player interface starts
  var Player = function (element, options) {
    this.element = element;
    this.options = options;

    for (var t in tech) {
      if (tech[t]
        && tech[t].canPlayType
        && tech[t].canPlayType(this.options.type)) {
        this.tech = new tech[t](this);
        break;
      }
    }
  };

  $.each(funcs, function (indx, key) {
    Player.prototype[key] = function () {
      var args = Array.prototype.slice.call(arguments);
      return this.tech[key].apply(this.tech, args);
    }
  });

  // Player interface ends

  // JQUERY stuff starts

  function initVideoPlayer(options) {
    var $this = $(this);
    options = options || $this.data();
    return new Player(this, options);
  }

  $.fn.videoplayer = function (options) {
    if (typeof options === 'object' || typeof options === 'undefined') {
      return this.each(function () {
        this.player = initVideoPlayer.call(this, options);
      });
    } else if (typeof options === 'string') {
      var args = Array.prototype.slice.call(arguments);
      args.shift();

      var values = [];
      this.each(function () {
        if (this.player[options]) {
          values.push(this.player[options].apply(this.player, args));
        }
      });

      if (values.length === 1) {
        return values[0];
      } else {
        return values;
      }
    }
  };

  // JQUERY stuff ends

})(jQuery, window);
