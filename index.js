var config = {};

var child_process = require('child_process');
var Promise = require('bluebird');

var DEBUG = process.env.DEBUG;

DEBUG && Promise.longStackTraces();

var d = module.exports.dbg = function() {

    if(arguments.length === 1 && typeof arguments[0] === 'string' && arguments[0].length) {
        console.info("  * " + arguments[0]);
    }
    else {
        config.debug && console.log.apply(null, arguments);
    }
};

module.exports.getConfig = function() { return config; };
module.exports.config = function(_conf) {

    _conf = _conf || {};
    Object.keys(_conf).forEach(function(key){
        config[key] = _conf[key];
    });

    config.debug = config.debug || DEBUG;

    var lib = {
        exports: module.exports,
        config: config
    };
    module.exports.lib = lib;

    var components = require('./lib/components');
    return components.list().then(function(list) {

        var handleRequest = function(op, component_name) {

            lib.op = op;
            lib.component_name = component_name;

//            d("%s %s", op, component_name ? component_name : "");

            return Promise.all(list)
                .filter(function(component) {

                    if(!component_name) {
                        return true;
                    }

                    return component.name === component_name;
                })
                .each(function(component) {

                    component.lib = lib;

                    console.info("[%s] %s %s", component.priority, op, component.name);

                    return component[op]();
                })
                .then(function() {
                    d("\n", "Done.");
                });
        };

        lib.start = function(component_name) {
            var op = "start";
            return handleRequest(op, component_name)
        };
        lib.stop = function(component_name) {
            var op = "stop";
            return handleRequest(op, component_name)
        };
        lib.restart = function(component_name) {
            var op = "restart";
            return handleRequest(op, component_name)
        };
        lib.status = function(component_name) {
            return handleRequest("status", component_name)
        };
        lib.services = function() {

            var rows = [
                "Managed services, by priority:"
            ];
            list.forEach(function(c) {
                rows.push( " * [" + c.priority + "] " + c.name );
            });

            console.log(rows.join("\n"));

            return Promise.resolve(true);
        };
        lib.setup = function(component_name) {

            console.warn("**************************************\n");
            console.warn("Forcing components setup. Service(s) will be restarted");
            console.warn("\n !!! This may be a destructive operation. \n\nWaiting 5 seconds before proceed (CTRL+C to quit) !!! \n");
            console.warn("\n**************************************");

            return new Promise(function(OK, NO) {

                var _run = function() {
                    lib.forceSetup = true;
                    handleRequest("restart", component_name).then(OK).catch(NO);
                };

                if(DEBUG) {
                    _run();
                }
                else {
                    setTimeout(function() {
                        _run();
                    }, 5000);
                }

            });
        };

        return lib;
    });
};

