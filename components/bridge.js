var lib = module.exports = {};

var Promise = require('bluebird');
var child_process = require('child_process');

var util = require('../lib/util');

lib.info = {

    name: "bridge",
    priority: 500,

    cwd: "/opt/servioticy/servioticy-bridge",

    script_name: "mqtt-and-stomp-bridge.js",

    foreverLog: "/tmp/forever.log",
    bridgeLog: "/tmp/bridge.js.out.log",
    bridgeErrLog: "/tmp/bridge.js.err.log",

};

lib.setup = function(component) {
    return Promise.resolve();
};

lib.ready = function() {
    return Promise.resolve();
};

lib.status = function() {
    return util.foreverProcess(lib.info.script_name);
};

lib.start = function() {
    var op = "run";
    return util.launch("forever", [

        "-a",
        "-l", lib.info.foreverLog,
        "-o", lib.info.bridgeLog,
        "-e", lib.info.bridgeErrLog,
        lib.info.script_name

    ], {
        cwd: lib.info.cwd
    }, 2000);
};

lib.stop = function() {
    return lib.status().then(function(res) {
        if(!res) return Promise.resolve();
        return util.execute("forever", ["stop", res.id]);
    });

};
