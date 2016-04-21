var Logger = require('../logger/logger');
var Newton = require('../newton/newton');
var GA     = require('../ga/ga');
var VHost  = require('../vhost/vhost');
var Location = require('../location/location');

var Facebook = new function(){

    var initialized = false;
    var isMobile = false;  // retrieve from stargate module

    this.init = function(params){
        Logger.log('GamifiveSDK', 'Facebook', 'init', params);

        if (parseInt(localStorage.getItem('hybrid')) !== 1){
          var d = document, s = 'script', id = 'facebook-jssdk';
          var js, fjs = d.getElementsByTagName(s)[0];
          if (d.getElementById(id)) return;
          js = d.createElement(s); js.id = id;
          js.src = "http://connect.facebook.net/en_US/sdk.js";
          fjs.parentNode.insertBefore(js, fjs);
        }

        window.fbAsyncInit = function() {
            if (typeof FB === 'undefined') {
                Logger.error('GamifiveSDK', 'FB', 'init', 'cannot download fb sdk');
            } else {
                FB.init({
                    appId      : VHost.get('appId'),
                    cookie     : true,    // enable cookies to allow the server to access
                    xfbml      : false,   // parse social plugins on this page
                    version    : 'v2.4'   // use version 2.1
                });
            }

           initialized = true;
        };

    }

    this.share = function(url, callback){

        if(!initialized){
          Logger.error('GamifiveSDK', 'Facebook', 'not yet initialized');
          return false;
        }

        Logger.info('GamifiveSDK', 'Facebook', 'share', url);

        var shareParams = {
            method: 'share',
            href: url,
        };
        
    	FB.ui(shareParams, function(response){
            if (typeof callback === 'function'){
    		    callback(response);
            }
    	});

    }

    this.send = function(url, callback){

        if(!initialized){
            Logger.error('GamifiveSDK', 'Facebook', 'not yet initialized');
            return false;
        }

        Logger.info('GamifiveSDK', 'Facebook', 'send', url);

        if (isMobile){
			var targetUrl = [
				'http://www.facebook.com/dialog/send',
	  			'?app_id=' + VHost.get('appId'),
				'&link=' + url,
				'&redirect_uri=' + Location.getOrigin()
			].join('');
			window.open(targetUrl, '_parent'); 
		}
		else {
            var shareParams = {
                method: 'send',
                display: 'iframe',
                link: url,
            };

			FB.ui(shareParams, function(response){
            
                if (typeof callback === 'function'){
        			callback(response);
                }
			});
		}
    }
};

module.exports = Facebook;
