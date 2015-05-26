
var Promise = require('bluebird');
var glob = require('glob');
var fs = require('fs');

var mgr = require('../index');

var d = mgr.dbg;

var DEBUG = false;
var dd = function() {DEBUG && console.log.apply(console, arguments) };

var cacheFile = __dirname + '/../tmp/components.json';
var cache = null;

if(cache === null) {
    if(fs.existsSync(cacheFile)) {
        cache = require(cacheFile);
    }
    else {
        cache = {};
    }
}
var saveCache = function() {
//    console.warn("CACHE DISABLED!");
    fs.writeFileSync(cacheFile, JSON.stringify(cache));
};

var Component = function(component) {

    this.config = component;

    this.name = this.config.info.name;
    this.priority = this.config.info.priority;
    this.info = this.config.info;
};

Component.prototype.start = function() {
    var me = this;
    return me.status().then(function(running) {

        if(running) {
            return Promise.resolve(running);
        }

        d("Starting")
        return me.config.start().then(function() {
            return me.ready().then(function() {
                return me.setup();
            });
        });
    });
};

Component.prototype.ready = function() {
    var me = this;
    dd("Waiting for service to became ready")
    return me.config.ready(me);
};

Component.prototype.stop = function() {
    var me = this;
    return me.status().then(function(running) {

        if(!running) {
            return Promise.resolve(running);
        }

        d("Stopping");
        return me.config.stop();
    });
};

Component.prototype.restart = function() {
    dd("Restarting")
    var me = this;
    return this.stop().then(function() {
        return me.start();
    });
};

Component.prototype.status = function() {
    return this.config.status()
        .then(function(running) {

            if(mgr.lib.op === 'status') d("Is " + (running ? "" : "NOT") + " running");

            dd((running ? "Is" : "Not") + " running");
            return Promise.resolve(running);
        });
};

Component.prototype.setup = function() {

    var me = this;

    return new Promise(function(OK, NO) {

        if(!me.needSetup()) {
            dd("Setup not needed");
            return OK();
        }
        else {
            d("Setup needed");
            return me.config.setup(me).then(function() {

                cache[me.config.info.name] = 1;
                saveCache();
                dd(" ...ok");
                return OK();
            });
        }

    });

};

Component.prototype.needSetup = function() {
    return mgr.lib.forceSetup || typeof cache[this.name] === 'undefined';
};

module.exports.Component = Component;

module.exports.list = function(path) {

    path = path || __dirname + "/../components";
    var opts = {};

    return new Promise(function(OK, NO) {
//        console.log(path + "/*.js");
        glob(path + "/*.js", opts, function(err, list) {

            if(err) {
                return NO(err);
            }

            if(!list.length) {
                return OK([]);
            }

            var components = [];
            list.forEach(function(file) {

                var comp = require(file);
                
                var name = null;
                var _a = file.match(/.*\/(.*)\.js/);
                
                if(_a) {
                    name = _a[1];
                }
                
                var path = "../config/" + name +".json";
                if(fs.existsSync(path)) {
                    try {
                        comp.info = require(path);
                    }
                    catch(e) {
                        comp.info = null;
                    }
                }
                else {
                    fs.writeFileSync(__dirname + "/" + path, JSON.stringify(comp.info, null, 2));
                }
                
                if(comp.info) {
                    components.push(new Component(comp));
                }
                else {
                    console.warn("%s: no component `info` property set, skipping", file);
                }

            });

            components = components.sort(function(a, b) {

                a.priority = typeof a.priority === 'undefined' ? 100 : a.priority;
                b.priority = typeof b.priority === 'undefined' ? 100 : b.priority;

                return a.priority > b.priority ? 1 : -1;
            });

            return OK(components);
        });

    });

};
