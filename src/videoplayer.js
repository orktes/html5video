(function ($, window) {

  var flashPath = "flash/bin-debug/FlashVideo.swf";
  var funcs = ["play", "pause", "stop", "currentTime", "duration", "setVolume", "volume", "ready"];
  var techOrder = ["html", "flash"];
  var videoTag = document.createElement('video');
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

  // HTML5 tech starts
  var HTML5Tech = function (player) {
    var self = this;

    EventEmitter.call(this);

    this.player = player;

    var element = $('<video width="' + this.player.options.width + '" height="' + this.player.options.height + '"></video>');

    if (this.player.options.autoplay) {
      element.attr('autoplay', 'autoplay');
    }

    element.append($('<source src="' + this.player.options.src + '" type=" ' + this.player.options.type + '"></source>'));
    $(this.player.element).append(element);

    this.video = element[0];

    self.playing = false;

    element.bind('pause', function () {
      self.playing = false;
      self.emit('pause');
    });

    element.bind('playing', function () {
      self.playing = true;
      self.emit('start');
    });

    element.bind('ended', function () {
      self.playing = false;
      self.emit('end');
    });

    element.bind('timeupdate', function () {
      if (self.playing)
        self.emit('progress');
    });
  };

  HTML5Tech.canPlayType = function (type) {
    return (videoTag.canPlayType && videoTag.canPlayType(type) !== "");
  };

  HTML5Tech.prototype = new EventEmitter();

  HTML5Tech.prototype.ready = function (callback) {
    callback.call(this);
  };

  HTML5Tech.prototype.currentTime = function () {
    return this.video.currentTime;
  };

  HTML5Tech.prototype.duration = function () {
    return this.video.duration;
  };

  HTML5Tech.prototype.setVolume = function (volume) {
    return this.video.volume = volume;
  };

  HTML5Tech.prototype.volume = function () {
    return this.video.volume;
  };

  HTML5Tech.prototype.stop = function () {
    this.video.load();
    this.video.pause();
    this.emit('stop');
    this.playing = false;
  };

  $.each(funcs, function (indx, key) {
    if (key == "ready"
      || key == "currentTime"
      || key == "duration"
      || key == "volume"
      || key == "setVolume"
      || key == "stop") { // ready is not generic
      return;
    }
    HTML5Tech.prototype[key] = function () {
      var args = Array.prototype.slice.call(arguments);
      return this.video[key].apply(this.video, args);
    }
  });

  tech['html'] = HTML5Tech;
  // HTML5 tech ends

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
        fileUrl: this.player.options.src,
        autoplay: !!(this.player.options.autoplay)
      }
    });

    var element = $(swfContent);
    this.swf = element[0];
    $(this.player.element).append(element);
  };

  FlashTech.prototype = new EventEmitter(); // Inherit event emitter

  FlashTech.canPlayType = function (type) {
    if ($.flash && $.flash.version && $.flash.version.major >= 10) {
      return type === "video/mp4";
    } else {
      return false;
    }
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

    if (!this.options.tech) {
      for (var t in tech) {
        if (tech[t]
          && tech[t].canPlayType
          && tech[t].canPlayType(this.options.type)) {
          this.tech = new tech[t](this);
          break;
        }
      }
    } else {
      this.tech = new tech[this.options.tech](this);
    }
  };

  $.each(funcs, function (indx, key) {
    Player.prototype[key] = function () {
      var args = Array.prototype.slice.call(arguments);
      return this.tech[key].apply(this.tech, args);
    }
  });

  $.each(["on", "once", "removeEventListener", "emit"], function (indx, key) {
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
