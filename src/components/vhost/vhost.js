var Logger  = require('../logger/logger');
var Network = require('../network/network');
var Event   = require('../event/event');

var VHost = new function(){

    var vHostInstance = this;

    var vHost;
    var gameSDKVHostUrl = 'api/vhost';

    var AFTER_LOAD_EVENT_KEY = 'VHOST_AFTER_LOAD';

    this.reset = function(){
        vHost = undefined;
    }

    this.load = function(){
        Network.xhr('GET', gameSDKVHostUrl, function(resp){

            if (!!resp && typeof resp.response !== 'undefined'){
                Logger.log('GamifiveSDK', 'VHost', 'load response', resp);
                vHost = resp.response;
            }
            Logger.log('GamifiveSDK', 'VHost', 'load', vHost);

            Event.trigger(AFTER_LOAD_EVENT_KEY);
        });
    }

    this.afterLoad = function(callback){
        Event.bind(AFTER_LOAD_EVENT_KEY, callback);
    }

    this.get = function(key){
        if (typeof vHost === 'undefined'){
            Logger.error('GamifiveSDK', 'VHost', 'get', 'cannot get "' + key + '" before loading the VHost');
            return undefined;
        }
        return vHost[key];
    }

};

module.exports = VHost;