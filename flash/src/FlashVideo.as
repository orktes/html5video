package
{
	import flash.display.LoaderInfo;
	import flash.display.Sprite;
	import flash.display.StageAlign;
	import flash.display.StageScaleMode;
	import flash.events.Event;
	import flash.events.NetStatusEvent;
	import flash.events.SecurityErrorEvent;
	import flash.events.TimerEvent;
	import flash.external.ExternalInterface;
	import flash.media.SoundTransform;
	import flash.media.Video;
	import flash.net.NetConnection;
	import flash.net.NetStream;
	import flash.system.Security;
	import flash.utils.Timer;
	
	public class FlashVideo extends Sprite
	{
		
		// EVENTS
		public static const READY:String = "ready";
		public static const START:String = "start";
		public static const RESUME:String = "resume";
		public static const STOP:String = "stop";
		public static const END:String = "end";
		public static const PAUSE:String = "pause";
		public static const PROGRESS:String = "progress";
		public static const ERROR:String = "error";
		
		// STATE
		private var _jsApiCallback:String = null;
		private var _fileUrl:String = null;
		private var _autoPlay:Boolean = false;
		private var _poster:String = null;
		
		private var _connection:NetConnection;
		private var _netStream:NetStream;
		private var _video:Video;
		private var _videoStarted:Boolean = false;
		private var _stopped:Boolean = false;
		private var _videoWidth:int = 0;
		private var _videoHeight:int = 0;
		private var _videoDuration:Number = 0;
		private var _netStreamInitialized:Boolean = false;
		private var _volume:Number = 1;
		private var _playTimer:Timer;
		private var _ended:Boolean = false;
		
		public function FlashVideo()
		{
			Security.allowDomain("*");
			Security.allowInsecureDomain("*");
			
			try
			{
				var paramObj:Object = LoaderInfo(this.root.loaderInfo).parameters;
				if(paramObj.jsApiCallback != null)
				{
					_jsApiCallback = paramObj.jsApiCallback;
					_fileUrl = paramObj.fileUrl;
					_poster = paramObj.poster;
					_autoPlay = (paramObj.autoplay != null && paramObj.autoplay == "true");
				}
			} 
			catch(e:Error)
			{
				emitError(e);
			}
			
			if (ExternalInterface.available)
			{
				ExternalInterface.addCallback("v_play", play);
				ExternalInterface.addCallback("v_pause", pause);
				ExternalInterface.addCallback("v_stop", stop);
				ExternalInterface.addCallback("v_currentTime", currentTime);
				ExternalInterface.addCallback("v_duration", duration);
				ExternalInterface.addCallback("v_isReady", isReady);
			} 
			
			stage.scaleMode = StageScaleMode.NO_SCALE;
			stage.align = StageAlign.TOP_LEFT;
			
			init();
			
			sendEvent(READY, null);
		}
		
		private function stage_onResize(e:Event) : void
		{
			resizeVideo();
		}
		
		private function init() : void
		{
			initPlayTimer();
			initPlayer();
			stage.addEventListener(Event.RESIZE, stage_onResize);
		}
		
		private function initPlayTimer() : void
		{
			_playTimer = new Timer(333, 0);
			_playTimer.addEventListener(TimerEvent.TIMER, function (evt:TimerEvent) : void {
				sendEvent(PROGRESS, null);
			});
		}
		
		private function initPlayer() : void
		{
			initialiseNetConnection();
			
			if (_autoPlay)
			{
				play();	
			}
		}
		
		private function initialiseNetConnection() : void
		{
			_connection = new NetConnection();
			_connection.addEventListener(NetStatusEvent.NET_STATUS, netStatusHandler);
			_connection.addEventListener(SecurityErrorEvent.SECURITY_ERROR, securityErrorHandler);
			_connection.connect(null);
		}
		
		private function connectStream() : void
		{
			_netStream = new NetStream(_connection);
			_netStream.addEventListener(NetStatusEvent.NET_STATUS, netStatusHandler);
			_netStream.client = new Object();
			_netStream.client.onMetaData = onMetaData;
			_netStream.client.onCuePoint = onCuePoint;
			_video = new Video();
			_video.attachNetStream(_netStream);
			addChild(_video);
		}
		
		private function onCuePoint(info:Object) : void
		{
			
		}
		
		private function onMetaData(info:Object) : void
		{
			
			_videoWidth = info.width;
			_videoHeight = info.height;
			_videoDuration = info.duration;
			resizeVideo();
		}
		
		private function isReady () : Boolean
		{
			return true;
		}
		
		private function resizeVideo () : void
		{
			if (stage && _video && _videoWidth > 0 && _videoHeight > 0)
			{
				var maxWidth:int = stage.stageWidth;
				var maxHeight:int = stage.stageHeight;
				
				var videoRatio:Number = _videoHeight / _videoWidth;
				
				var newHeight:int = 0;
				var newWidth:int = 0;
				
				if ((videoRatio * maxWidth) > maxHeight)
				{
					newHeight = maxHeight;
					newWidth = maxHeight / videoRatio;
				}
				else
				{
					newWidth = maxWidth;
					newHeight = videoRatio * maxWidth;
				}
				
				_video.width = newWidth;
				_video.height = newHeight;
				
				var offsetX:int = (maxWidth - newWidth) / 2;
				var offsetY:int = (maxHeight - newHeight) / 2;
				
				_video.x = offsetX;
				_video.y = offsetY;			
				
			}
		}
		
		private function netStatusHandler(event:NetStatusEvent) : void 
		{
			switch (event.info.code)
			{
				case "NetConnection.Connect.Success":
					connectStream();
					break;
				case "NetStream.Play.StreamNotFound":
					emitError(new Error("Stream not found"));
					break;
				case "NetStream.Buffer.Full":
					if (!_videoStarted)
					{
						onStarted();
						_videoStarted = true;
					}
					
					break;
				case "NetStream.Play.Stop":
					if (!_stopped)
						onEnded();
					stop();
					break;
			}
		}
		
		private function onStarted () : void {
			sendEvent(START, null);
			_playTimer.start();
		}
		
		private function onStopped () : void {
			if (!_ended)
				sendEvent(STOP, null);
			_playTimer.stop();
		}
		
		private function onEnded () : void {
			sendEvent(END, null);
			_ended = true;
			_playTimer.stop();
		}
		
		private function onPaused () : void {
			sendEvent(PAUSE, null);
			_playTimer.stop();
		}
		
		private function onResume () : void {
			sendEvent(RESUME, null);
			_playTimer.start();
		}
		
		private function securityErrorHandler(event:SecurityErrorEvent) : void
		{
			emitError(new Error("SecurityErrorEvent: " + event.type));
		}
		
		private function duration() : Number
		{
			return _videoDuration;
		}
		
		private function volume() : Number
		{
			return _volume;
		}
		
		private function currentTime() : Number
		{
			return _netStream.time;
		}
		
		
		private function setVolume(volume:Number) : void
		{
			var sndTransform	= new SoundTransform(volume);
			_netStream.soundTransform	= sndTransform;
			_volume = volume;
		}
		
		private function play() : void
		{
			if (!_netStreamInitialized)
			{
				_netStream.play(_fileUrl);
				_netStreamInitialized = true;
			}
			else
			{
				_netStream.resume();
				onResume();
			}
		}
		
		private function pause() : void
		{
			_netStream.pause();
			onPaused();
		}
		
		private function stop() : void
		{
			_netStream.pause();
			_netStream.seek(0);
			onStopped();
		}
		
		private function seek(offset:Number) : void
		{
			_netStream.seek(offset);	
		}
		
		private function emitError(e:Error) : void
		{
			sendEvent(ERROR, {message: e.message});
		}
		
		private function sendEvent(type:String, data:Object) : void
		{
			if (data == null) {
				data = {};
			}
			
			try {
				ExternalInterface.call(_jsApiCallback, type, data);
			} catch (e:Error) {}
		}
		
		private function logToJS(msg:String) : void
		{
			try {
				ExternalInterface.call('console.log', msg);
			} catch (e:Error) {}
		}
		
	}
}