var Promise   = require('promise-polyfill');
var API = require('../api/api');
var Constants = require('../constants/constants');
var DOMUtils  = require('../dom/dom-utils');
var GameInfo  = require('../game_info/game_info');
var Location  = require('../location/location');
var Logger    = require('../logger/logger');
var Menu      = require('../menu/menu');
var Network   = require('../network/network');
var User      = require('../user/user');
var VHost     = require('../vhost/vhost');
var Stargate  = require('stargatejs');

var NewtonService = require('../newton/newton');
import Facebook from '../fb/fb';
import Event from '../event/event';
import { Utils } from 'stargatejs';
import { calculateContentRanking } from '../tracking_utils/tracking_utils';
import { Banner } from '../banner/banner';
import { isAndroid } from '../platform/platform';
let BannerIstance;
let matchesPlayed = 0;
const { getType } = Utils;
var state = require('../state/state');

/**
* Session module
* @namespace Session
* @version 0.9
*/
var Session = new function(){
    
    var initPromise;
    var initialized = false;
    var sessionInstance = this;
    var menuIstance;
    var startCallback = function(){};
    var contentRanking;
    var config = {sessions:[]};
    
    //[[GET, url]]
    var toDoXHR = [];
    /**
    * returns whether Session has already been initialized
    * @function isInitialized
    * @memberof Session
    */
    this.isInitialized = function(){
        return initialized;
    };

    /**
    * resets the internal configuration to default value
    * @function reset
    * @memberof Session
    */
    this.reset = function(){
        initPromise = null;
        config = {sessions:[]};
    };    

    /**
    * returns the internal configuration
    * @function getConfig
    * @memberof Session
    */
    this.getConfig = function(){        
        return config;
    };

    /**
    * sets a callback to be fired after the VHost has been loaded
    * @function afterLoad
    * @private
    * @memberof VHost
    */
    var afterInit = function(callback){
        if (typeof callback !== 'function'){
            throw Constants.ERROR_AFTERINIT_CALLBACK_TYPE + typeof callback;
        }

        if (initPromise){
            initPromise.then(callback)
        } else {
            throw new Error(Constants.ERROR_SESSION_INIT_NOT_CALLED);
        }
    };

    Event.on('INIT_FINISHED', function(){
        initialized = true;
        if(Stargate.isHybrid()){
            NewtonService.trackEvent({
                rank: calculateContentRanking(GameInfo, User, VHost, 'Play', 'GameLoad'),
                name: 'GameLoad',
                properties:{
                    action: 'Yes',
                    category: 'Play',
                    game_title: GameInfo.getInfo().game.title,
                    label: GameInfo.getContentId(),
                    valuable: 'No'
                }
            }); 
        }
    });

    Event.on('GO_TO_HOME_CLICK', function(){
        NewtonService.trackEvent({
            rank: calculateContentRanking(GameInfo, User, VHost, 'Play', 'GameLoad'),            
            name: 'GoToHome',
            properties:{
                action: 'Yes',
                category: 'Behavior',
                game_title: GameInfo.getInfo().game.title,
                label: GameInfo.getContentId(),
                valuable: 'No'                            
            }
        });
    });

    Event.on('INIT_ERROR', function(ev){
        NewtonService.trackEvent({
            name: 'SdkInitError',                        
            properties:{
                action: 'No',
                category: 'SDK_ERROR',
                label: GameInfo.getContentId(),
                valuable: 'No',
                reason: ev.reason
            }
        });    
    });

    Event.on('NATIVE_APP_PROMO_CLICK', function(){
        let mfp_url = [Location.getOrigin(), '/#!/mfp'].join('');

        mfp_url = Utils.queryfy(mfp_url, {
            returnurl: `${Location.getCurrentHref()}`,
            title: ''
        });

        NewtonService.trackEvent({
            name: 'NativeAppPromoClick',
            properties:{
                action: 'Yes',
                category: 'Behavior',
                valuable: 'Yes',
            }
        });
        window.location.href = mfp_url;
    });

    Event.on('NATIVE_APP_PROMO_CLOSE', function(){
        NewtonService.trackEvent({
            name: 'NativeAppPromoClose',                        
            properties:{
                action: 'Yes',
                category: 'Behavior',
                valuable: 'Yes',
            }
        });
    });

    Event.on('NATIVE_APP_PROMO_LOAD', function(){
        NewtonService.trackEvent({
            name: 'NativeAppPromoLoad',                        
            properties:{
                action: 'Yes',
                category: 'Behavior',
                valuable: 'Yes',
            }
        });
    });
    
    /**
    * initializes the module with custom parameters
    * @function init
    * @memberof Session
    * @param {Object} params - can contain "lite" (boolean) attribute
    * @param {Boolean} params.lite
    * @param {Boolean} params.debug 
    */
    this.init = function(params){
        Event.trigger('INIT_START', {type:'INIT_START'});
        if(process.env.NODE_ENV === "debug"){
            Logger.warn("GFSDK: Running in debug mode!")
        }
        
        if (!params){
            params = {};
        }

        Logger.info('GamifiveSDK', 'Session', 'init', params);

        // convert it if it's a number
        if(getType(params.lite) === 'number'){
            params.lite = !!params.lite;
        }

        if (typeof params.lite !== 'undefined' && typeof params.lite !== 'boolean'){
            throw Constants.ERROR_LITE_TYPE + typeof params.lite;
        }

        config = Utils.extend(config, params);

        if (getType(config.moreGamesButtonStyle) !== 'undefined'){
            Menu.setCustomStyle(config.moreGamesButtonStyle);
        }

        Menu.setGoToHomeCallback(sessionInstance.goToHome);
        
        var SG_CONF = {};
        // let's dance     
        if (Stargate.isHybrid() 
            && window.location.protocol === 'cdvfile:'){ 
            // added for retro compatibility: 
            // game module should not be initialized in old hybrid app without offline
            SG_CONF = {
                modules:[
                    ['game', {
                        sdk_url: '',  
                        api: '',
                        gamifive_info_api: '', 
                        bundle_games: []
                        }
                    ]
                ]
            };
        }
        
        initPromise = Stargate.initialize(SG_CONF)
               .then(function(){
                   return VHost.load();
               })
               .then(function(){
                    Event.trigger('VHOST_LOADED');
                    Menu.setSpriteImage(VHost.get('IMAGES_SPRITE_GAME'));
                    contentRanking = VHost.get('CONTENT_RANKING');
                    Menu.show();
                    
                    let UserTasks = User.fetch().then(() => User.getFavorites());
                    let promises = [
                            UserTasks,
                            GameInfo.fetch(),
                            loadDictionary()
                        ];
                    
                    return Promise.all(promises);
               })
               .then(function(){                    
                    Event.trigger('USER_LOADED');                 
                    Facebook.init({ fbAppId: GameInfo.getInfo().fbAppId });
                    
                    var env = Stargate.isHybrid() ? 'hybrid' : 'webapp';
                    var enableNewton = true;
                    if(env === 'hybrid' && Stargate.checkConnection().type !== 'online'){
                        enableNewton = false;
                    }

                    NewtonService.init({
                        secretId: VHost.get('NEWTON_SECRETID'),
                        enable: enableNewton, // enable newton
                        waitLogin: true,     // wait for login to have been completed (async)
                        logger: Logger,
                        properties: {
                            environment: env,
                            white_label_id: GameInfo.getInfo().label
                        }
                    });

                    let queryString = Location.getQueryString();
                    if (getType(queryString.dest) === 'undefined'){
    					queryString.dest = 'N/A';
                    }
                    
                    let toAdd = [
                        ['country', VHost.get('TLD')], 
                        ['real_country', VHost.get('NT_REAL_COUNTRY')],
                        ['white_label_id', GameInfo.getInfo().label],
                        ['http_referrer', window.document.referrer]
                    ];

                    let userProperties = toAdd.reduce((accumulator, keyValue)=>{
                        if(keyValue[1]){
                            accumulator[keyValue[0]] = keyValue[1];
                        }
                        return accumulator;
                    }, queryString);

                    /** wait newton login */
                    return NewtonService.login({
                        type: 'external',
                        userId: User.getUserId(), 
                        userProperties: userProperties,
                        logged: (User.getUserType() !== 'guest')
                    }).catch((reason)=>{
                        return Promise.resolve();
                    });
                }).then(function(){               
                    Logger.log('GamifiveSDK', 'register sync function for gameover/leaderboard results');
                    Stargate.addListener('connectionchange', sync);
                    // If the user calls loadUserData before init finished this is not empty
                    if(state.userDataPromise){
                        return state.userDataPromise();
                    }                    
                }).then(function(){
                    Event.trigger('INIT_FINISHED', {type:'INIT_FINISHED'});
                    if(!Stargate.isHybrid() && Location.isGameasy()){
                        Logger.log('GamifiveSDK init build INGAME_BANNER');
                        
                        BannerIstance = new Banner({
                            containerSelector: '#native-modal',
                            closeButtonSelector: 'button#close-button',
                            installButtonSelector: 'button#install-hybrid-button',
                            onInstallClick: function(){
                                Event.trigger('NATIVE_APP_PROMO_CLICK');
                            },
                            onCloseClick: function(){
                                Event.trigger('NATIVE_APP_PROMO_CLOSE');
                            },
                            onOpen: function(){
                                Event.trigger('NATIVE_APP_PROMO_LOAD');
                            },
                            onLoad: function(){}
                        });
                    }
                }).catch(function(reason){
                    Event.trigger('INIT_ERROR', {type:'INIT_ERROR', reason:reason});                    
                    Logger.error('GamifiveSDK init error: ', reason);
                    initialized = false;
                    throw reason;
               });

        return initPromise; 
    };

    var getLastSession = function(){
        return config.sessions[0];
    };

    function loadDictionary(){
        if(!Stargate.isHybrid()) { return Promise.resolve(); }
        var path = [Stargate.file.BASE_DIR, Constants.DICTIONARY_JSON_FILENAME].join('');
        return Stargate.file.readFileAsJSON(path)
            .then(function(dictjson){
                window.DICTIONARY = dictjson || {};
                return window.DICTIONARY;
            })
            .catch(function(reason){
                Logger.warn('Cannot load dict.json', reason);
            });
    }

    function sync(networkStatus){
        if(networkStatus.type === 'online'){
            if(toDoXHR.length === 0){ Logger.log('No xhr to sync', toDoXHR); return;}
            Logger.log('Try to sync', toDoXHR);
            var promiseCallsList = toDoXHR.map(function(todo, index, arr){
                return Network.xhr(todo[0], todo[1]);
            });

            Promise.all(promiseCallsList)
                .then(function(results){
                    // filtering results, get the unsuccess calls indexes
                    return results
                        .map(function(element, index){if(!element.success) return index; })
                        .filter(function(index){ if(index !== undefined){ return true;} });

                }).then(function(indexesToRetain){
                    Logger.log('before toDoXHR list', toDoXHR);
                    // retain because they failed
                    var toRetain = indexesToRetain.map(function(index){ return toDoXHR.slice(index, index + 1) });

                    toDoXHR = toRetain.reduce(function(prev, current){ return prev.concat(current) }, []);
                    Logger.log('after toDoXHR list', toDoXHR);
                });
        }
    }

    /**
    * starts a new gameplay session
    * @function start
    * @access private
    * @memberof Session
    */
    function __start(){
        Logger.info('GamifiveSDK', 'Session', 'start');

        Menu.hide();

        function doStartSession(){            
            NewtonService.trackEvent({
                name: "GameStart",
                rank: calculateContentRanking(GameInfo, User, VHost, 'Play', 'GameStart'), 
                properties:{
                    category: "Play", 
                    game_title: GameInfo.getInfo().game.title,
                    label: GameInfo.getContentId(),
                    valuable: "Yes",
                    action: "Yes"                  
                }
            });
            
            try{
                Event.trigger('ON_START_SESSION_CALLED');
                startCallback();
            } catch(e){
                Logger.error('GamifiveSDK', 'onStartSession ERROR', e);
            }                        
        }

        if (!config.lite){            
            User.canPlay()
                .then(function(canPlay){
                    if(canPlay){
                        // clear dom
                        DOMUtils.delete();
                        doStartSession();
                    } else {
                        // Call the paywall instead?
                        return gameOver({ start: 0, duration: 0, score: 0, level: 0 });
                    }
                });
        } else {            
            doStartSession();
        }
    }

    /**
    * starts a new gameplay session
    * @function start
    * @access public
    * @memberof Session
    */
    this.start = function(){
        if (!initPromise){
            Logger.warn(Constants.ERROR_SESSION_INIT_NOT_CALLED);
            return false;
        }       
        
        if (config.sessions && config.sessions.length > 0 && typeof getLastSession().endTime === 'undefined'){
            config.sessions.shift();
            Logger.warn(Constants.ERROR_SESSION_ALREADY_STARTED);
        }
        Event.trigger('START_SESSION_CALLED');
        // ok, you can try to start a new session
        config.sessions.unshift({
            startTime: new Date(),
            endTime: undefined,
            score: undefined,
            level: undefined
        });

        // cut out the older sessions
        config.sessions = config.sessions.slice(0, Constants.MAX_RECORDED_SESSIONS_NUMBER);
                
        return initPromise.then(function(){
            return __start();
        });
    };

    /**
    * sets a callback function to be called when starting a gameplay session
    * @function onStart
    * @memberof Session
    * @param {function} callback the function to be called when the game starts
    */
    this.onStart = function(callback){
        if (typeof callback === 'function'){
            Logger.info('GamifiveSDK', 'Session', 'register onStart callback');
            startCallback = callback;
        } else {
           Logger.warn(Constants.ERROR_ONSTART_CALLBACK_TYPE + typeof callback);
        }
    };

    /**
    * sets a callback function to be called when the game enters pause status
    * @function onPauseEnter
    * @memberof Session
    * @param {function} callback the function to be called when the game pauses
    */
    this.onPauseEnter = function(callback){
        Logger.log('GamifiveSDK', 'Session', 'onPauseEnter');
        Menu.show();
    };

    /**
    * sets a callback function to be called when the game exits pause status
    * @function onPauseExit
    * @memberof Session
    * @param {function} callback the function to be called when the game resumes
    */
    this.onPauseExit = function(callback){
        Logger.log('GamifiveSDK', 'Session', 'onPauseExit');
        Menu.hide();
    };

    /**
    * ends a session and (if not in lite mode) shows the platform's gameover screen    
    * @function end
    * @memberof Session
    * @param {Object} data can contain a "score" and/or "level" attribute
    * @param {Number} [data.score=0] - the score of the user in the sesssion
    * @param {Number} [data.level=0] - the level
    */
    this.end = function(data={score:0, level:0}){        
        Logger.info('GamifiveSDK', 'Session', 'end', data);
        
        if (!initPromise){
            Logger.warn(Constants.ERROR_SESSION_INIT_NOT_CALLED);
        }

        if (config.sessions.length < 1){
            Logger.warn(Constants.ERROR_SESSION_NO_SESSION_STARTED);
        }

        if (getType(getLastSession().endTime) !== 'undefined'){
            Logger.warn(Constants.ERROR_SESSION_ALREADY_ENDED);
        }

        NewtonService.trackEvent({
            rank: calculateContentRanking(GameInfo, User, VHost, 'Play', 'GameEnd'),
            name:'GameEnd', 
            properties:{
                category: 'Play',
                game_title: GameInfo.getInfo().game.title,
                label: GameInfo.getContentId(),
                valuable: 'No',
                action: 'No'                
            }
        });

        getLastSession().endTime = new Date();

        if (data.hasOwnProperty('score')){
            if (getType(data.score) === 'number'){
                getLastSession().score = data.score;                
            } else {
                Logger.warn(Constants.ERROR_SCORE_TYPE + getType(data.score));        
            }
        }

        if (data.hasOwnProperty('level')){
            if (getType(data.level) === 'number'){
               getLastSession().level = data.level;
            } else {
                Logger.warn(Constants.ERROR_LEVEL_TYPE + getType(data.level));
            }
        }

        var lastSession = getLastSession();

        if(config.lite){
            if(BannerIstance && !(matchesPlayed % 3) && VHost.get('INSTALL_HYBRID_VISIBLE') && isAndroid()){
                BannerIstance.open();
            }
            
            // call only leaderboard
            var leaderboardParams = {
				'start': lastSession.startTime.getTime(),
				'duration': lastSession.endTime - lastSession.startTime,
				'score': lastSession.score,
                'level': lastSession.level,
	      		'newapps': 1,
	      		'appId': GameInfo.getContentId(),
	      		'label': GameInfo.getInfo().label,
	      		'userId': User.getUserId(),
                'format': 'jsonp'
			};
           
            var leaderboardCallUrl = API.get('LEADERBOARD_API_URL');
            leaderboardCallUrl = Utils.queryfy(leaderboardCallUrl, leaderboardParams);
            
            Logger.log("Leaderboard ", leaderboardCallUrl);            
            
            if (Stargate.checkConnection().type === 'online'){
                Network.xhr('GET', leaderboardCallUrl);
            } else {
                enqueue('GET', leaderboardCallUrl);
            }
            matchesPlayed++;
        } else {
            // call gameover
            var gameoverParams = {
                start: lastSession.startTime.getTime(),
                duration: lastSession.endTime - lastSession.startTime,
                score: lastSession.score
            };
            
            if(lastSession.level){
                gameoverParams.level = lastSession.level;
            }
            gameOver(gameoverParams)
                .then(DOMUtils.create)
                .then(function(){
                    /**
                     * The shit is coming
                     */
                    // metaviewport fix
                    var metaViewportTag = window.document.querySelector("meta[name=viewport]");
                    if(metaViewportTag){
                        metaViewportTag.setAttribute("content","width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no");
                    }  
                    // attach listener to back button
                    if(document.querySelector(Constants.BACK_BUTTON_SELECTOR)){
                        var toHomeBtn = document.querySelector(Constants.BACK_BUTTON_SELECTOR).parentNode;
                        
                        toHomeBtn.addEventListener('click', function tohome(e){
                            e.stopPropagation();
                            e.preventDefault();
                            sessionInstance.goToHome();                            
                            //remove it everytime to prevent memory leak
                            toHomeBtn.removeEventListener('click', tohome);
                        });
                    }

                    // disabled false
                    var state = Stargate.checkConnection().type === 'online' ? false : true;
                    var buttons = document.querySelectorAll('.social .btn');
                    	
                    buttons = [].slice.call(buttons);
                    buttons.map(function(button){ button.disabled = state; });

                    Stargate.addListener('connectionchange', function(conn){
                        var state;
                        conn.type === 'online' ? state = false : state = true;					
                        buttons.map(function(button){ button.disabled = state; })
                    });
                    var isFav = User.isGameFavorite(GameInfo.getContentId());
                    DOMUtils.updateFavoriteButton(isFav);
                });  
        }

        Menu.show();
    };

    /**
     * Build the gameover if online or offline hybrid and returns it as a compiled html string
     * @param {object} gameoverParams
     * @param {number} gameoverParams.start
     * @param {number} gameoverParams.duration
     * @param {number} gameoverParams.score
     * @param {number} [gameoverParams.level]
     * @returns {Promise<String>} the html as string gameover
     */
    function gameOver(gameoverParams){
        var url = [API.get('GAMEOVER_API_URL'), GameInfo.getContentId()].join("/");
        url = Utils.queryfy(url, gameoverParams);
        Logger.log('Gameover ', url);        

        if (Stargate.checkConnection().type === "online"){
            return Network.xhr('GET', url).then(function(resp) {
                if(Stargate.isHybrid() && window.location.protocol === 'cdvfile:'){
                    gameoverParams.content_id = GameInfo.getContentId();
                    return Stargate.game.buildGameOver(gameoverParams);
                }
                return resp.response;
            });
        } else if(Stargate.checkConnection().type === "offline" && Stargate.isHybrid()){

            gameoverParams.content_id = GameInfo.getContentId();
            enqueue('GET', url);
            return Stargate.game.buildGameOver(gameoverParams);
        } else {
            Logger.log("Fail build gameover, you are offline", Stargate.checkConnection());
        }
    }

    /**
    * returns to the main page of the webapp
    * @function goToHome
    * @memberof Session
    */
    this.goToHome = function(){
        Logger.info('GamifiveSDK', 'Session', 'goToHome');
        Event.trigger('GO_TO_HOME_CLICK');
        if (Stargate.isHybrid()){
            if(window.webview){
                window.webview.Close();
            } else {
                // In local index there's already a connection check
                Stargate.goToLocalIndex();
            }
        } else {
            window.location.href = Location.getOrigin();
        }
    };

    function persistXHR(){
        if(Stargate.isHybrid()){
            var TODO_XHR_PATH = [Stargate.file.BASE_DIR, 'toDoXHR.json'].join('');
            return Stargate.file.write(TODO_XHR_PATH, JSON.stringify(toDoXHR));
        }
    }

    /**
     * Save the call for later
     */
    function enqueue(method, url){
        var saved = ['GET', url];
        Logger.info(saved, ' save the call for later');
        toDoXHR.push(saved);
    }

    if (process.env.NODE_ENV === "testing"){
        var original = {
            Stargate:null,
            User:null,
            VHost:null,
            GameInfo:null,
            Menu:null
        };

        this.setMock = function(what, mock){            
            switch(what){
                case "User":
                    original.User = require('../user/user');
                    User = mock;
                    break;
                case "Stargate":
                    original.Stargate = require('stargatejs');
                    Stargate = mock;
                    break;
                case "VHost":
                    original.VHost = require('../vhost/vhost');
                    VHost = mock;
                    break;
                case "GameInfo":
                    original.GameInfo = require('../game_info/game_info');
                    GameInfo = mock
                    break;
                case "Menu":
                    original.Menu = require('../menu/menu');
                    Menu = mock;
                    break;
                case "NewtonService":
                    original.NewtonService = require('../newton/newton');
                    NewtonService = mock;
                    break;
                default:
                    break;
            }
        };

        this.unsetMock = function(what){
            if (!original[what]) return;
            switch(what){
                case "User":
                    User = original.User;
                    original.User = null;
                    break;
                case "Stargate":
                    Stargate = original.Stargate;
                    original.Stargate = null;
                    break;
                case "VHost":
                    VHost =  original.VHost;
                    original.VHost = null;
                case "GameInfo":
                    GameInfo = original.GameInfo;
                    original.GameInfo = null;
                    break;
                case "Menu":
                    Menu = original.Menu;
                    original.Menu = null;
                    break;
                case "NewtonService":
                    NewtonService = original.NewtonService;
                    original.NewtonService = null;
                    break;
                default:
                    break;
            }
        }
    }

};

module.exports = Session;