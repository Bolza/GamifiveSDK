	/**
	* Main SDK Class 0.1 JSDoc Reference
	* @class
	* The GamefiveSDK for JavaScript consists of a single JS file to be included in a SCRIPT element in the HEAD tag of your game HTML. 
	* @tutorial [Version 0.1 Minified Source CDN]{@link  http://s.motime.com/js/wl/webstore_html5game/gfsdk/dist/gfsdk-0.1.min.js}
	* @author Stefano Sergio
	*/
	function GamefiveSDK() {
		var mipId, appId, userId, label;
		var sessionData = {
			version: '0.1.2'
		};		
		var currentConf = {
			logEnabled: false,
			httpEnabled: true
		};

		if (!Date.now) {
	    	Date.now = function() { return new Date().getTime() };
		}

		var cookie = {
			get: function (sKey) {
				return decodeURIComponent(document.cookie.replace(new RegExp("(?:(?:^|.*;)\\s*" + encodeURIComponent(sKey).replace(/[\-\.\+\*]/g, "\\$&") + "\\s*\\=\\s*([^;]*).*$)|^.*$"), "$1")) || null;
			},
			set: function (sKey, sValue, vEnd, sPath, sDomain, bSecure) {
				if (!sKey || /^(?:expires|max\-age|path|domain|secure)$/i.test(sKey)) { return false; }
				var sExpires = "";
				if (vEnd) {
					switch (vEnd.constructor) {
						case Number:
						sExpires = vEnd === Infinity ? "; expires=Fri, 31 Dec 9999 23:59:59 GMT" : "; max-age=" + vEnd;
						break;
						case String:
						sExpires = "; expires=" + vEnd;
						break;
						case Date:
						sExpires = "; expires=" + vEnd.toUTCString();
						break;
					}
				}
				document.cookie = encodeURIComponent(sKey) + "=" + encodeURIComponent(sValue) + sExpires + (sDomain ? "; domain=" + sDomain : "") + (sPath ? "; path=" + sPath : "") + (bSecure ? "; secure" : "");
				return true;
			},
			remove: function (sKey, sPath, sDomain) {
				if (!sKey || !this.has(sKey)) { return false; }
				document.cookie = encodeURIComponent(sKey) + "=; expires=Thu, 01 Jan 1970 00:00:00 GMT" + ( sDomain ? "; domain=" + sDomain : "") + ( sPath ? "; path=" + sPath : "");
				return true;
			},
			has: function (sKey) {
				return (new RegExp("(?:^|;\\s*)" + encodeURIComponent(sKey).replace(/[\-\.\+\*]/g, "\\$&") + "\\s*\\=")).test(document.cookie);
			}
		};

		var xhr = function() {
		    return function( method, url, callback ) {
		    	var xhr = new XMLHttpRequest();
		        xhr.onreadystatechange = function() {
		            if ( xhr.readyState === 4 ) {
		                if (callback) callback( xhr.responseText );
		            }
		        };
		        xhr.open( method, url );
		        xhr.send();
		        return xhr;
		    };
		}();

		function querify(obj) {
			var str = [];
			for(var p in obj) {
				if (obj.hasOwnProperty(p)) str.push(encodeURIComponent(p) + "=" + encodeURIComponent(obj[p]));
			}
			return '?'+str.join("&");
		}


		var init = function() {
			var gfInfo = window.GamifiveInfo || {};
			sessionData.userId = gfInfo.userId;
			sessionData.label = gfInfo.label;
			sessionData.appId = gfInfo.contentId;
			if (currentConf.logEnabled) console.log('GamefiveSDK->init', sessionData);
		}

		/**
		* Updates the config if needed by the user
		* @param {object} confObject - Configuration object
		* @param {boolean} [confObject.logEnabled=false] - Logging state, only for debug
		* @param {boolean} [confObject.httpEnabled=true] - Enable/Disable xhr calls, should always be TRUE
		*/
		this.updateConfig = function(confObj) {
			if (typeof confObj != 'object') confObj = {};
			currentConf.logEnabled = confObj.logEnabled || currentConf.logEnabled;
			currentConf.httpEnabled = confObj.httpEnabled || currentConf.httpEnabled;
		}

		/**
		* Defines the start of a session. A session is a continued user activity like a game match and the start of a session usually corresponds
		* <br>
		* Ideally a session starts when the player starts playing from the beginning and his score is set to zero. So in this version of the API
		* the startSession must be called alongside with the PLAY function of your game.<br>
		*/
		this.startSession = function() {
			if (currentConf.logEnabled) console.log('GamefiveSDK.startSession', arguments);
			sessionData.timestart = Date.now();
		}
		
		/**
		* Defines the end of a session. A session is a continued user activity like a game match. <br>
		* It should end with the score of that session. 
		* Ideally a session ends when the player cannot continue his match and must play again from the beginning. <br>
		* For example: if the player has x "lifes" then the session only ends when all the x "lifes" are lost. <br>
		* <i>.startSession must be called first.</i>
		* @param {object} endingParams - Some parameters can be sent inside an object to enrich the user statistics.
		* @param {object} endingParams.score - User score for the ended session.
		*/	
		this.endSession = function(endingParams) {
			if (currentConf.logEnabled) console.log('GamefiveSDK.endSession', arguments);
			sessionData.timeend = Date.now();
			var querystring = querify({ 
				'newapps': 1,
				'appId': sessionData.appId,
				'label': sessionData.label,
				'userId': sessionData.userId,
				'start': sessionData.timestart,
				'duration': sessionData.timeend - sessionData.timestart,
				'score': parseFloat(endingParams.score) || 0
			});
			
			if (currentConf.httpEnabled) xhr('GET', '/v01/leaderboard'+querystring);
		}

		/**
		* Get SDK Status and Data 
		* @returns {Object} Object containing Session and User Information
		*/
		this.status = function() {
			return sessionData;
		}

		this.fbInvite = function () {
			xhr('GET', 'https://graph.facebook.com/me/friends', function(e){
				console.log(e);
				
			});
		}


		// Initialize the library
		init();
	}
