var lib = module.exports = {};

var Promise = require('bluebird');
var child_process = require('child_process');

var util = require('../lib/util');

lib.info = {
    disabled: true,
    name: "kestrel",
    priority: 350,

    kestrelHome: "/opt/servioticy/kestrel-2.4.1/",
    javaHome: "/usr/lib/jvm/java-7-oracle",
    logFile: '/tmp/kestrel.log',

    args: [
        "-server", "-Xmx1024m",
        "-Dstage=servioticy_queues",
        "-jar", "kestrel_2.9.2-2.4.1.jar"
    ],

    search_pattern: "\-jar kestrel\_",

};

lib.setup = function(component) {
    return Promise.resolve();
};

lib.ready = function() {
    return Promise.resolve();
};

lib.status = function() {
    var search_pattern = lib.info.search_pattern;
    return util.ps(search_pattern);
};

lib.start = function() {

    var _env = {};
    for(var i in process.env) {
        _env[i] = process.env[i];
    }

    _env.JAVA_HOME = lib.info.javaHome;
    _env.PATH = lib.info.javaHome + "/bin:" + _env.PATH;

    var out = require('fs').openSync(lib.info.logFile, 'w');

    return util.launch(lib.info.javaHome + "/bin/java", lib.info.args, {
        cwd: lib.info.kestrelHome,
        env: _env,
        stdio: [ 'ignore', out, out ]
    });
};

lib.stop = function() {
    return lib.status().then(function(running) {

        if(!running || !running.pid) {
            return Promise.resolve();
        }

        return util.kill(running.pid);
    });
};
