var lib = module.exports = {};

var Promise = require('bluebird');
var child_process = require('child_process');

var util = require('../lib/util');

lib.info = {
    disabled: true,
    name: "storm",
    priority: 400,

    command: 'bin/storm',
    stormHome: "/opt/servioticy/apache-storm-0.9.4",
    dispatcherHome: "/opt/servioticy/servioticy-dispatcher",

    dispatcherJar: "dispatcher.jar",
    dispatcherXml: "dispatcher.xml",

    javaHome: "/usr/lib/jvm/java-7-oracle",
    logFile: '/tmp/storm.log',

    search_pattern: "apache\-storm",
    waitFor: 15 * 1000, // wait for 15 sec

};

lib.setup = function(component) {
    return Promise.resolve();
};

lib.ready = function() {
    return new Promise(function(success, fail) {
        setTimeout(function() {
            success();
        }, lib.info.waitFor);
    })
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

//    console.log("cwd is ", lib.info.stormHome);
//    console.log("log file is ", lib.info.logFile);

/*    console.log("Launch ", [ lib.info.command,
        "jar", lib.info.dispatcherHome + "/" + lib.info.dispatcherJar,
        "com.servioticy.dispatcher.DispatcherTopology",
        "-f", lib.info.dispatcherHome + "/" + lib.info.dispatcherXml,
        "-d"
    ].join(' '));
*/

    return util.launch(lib.info.command, [
        "jar", lib.info.dispatcherHome + "/" + lib.info.dispatcherJar,
        "com.servioticy.dispatcher.DispatcherTopology",
        "-f", lib.info.dispatcherHome + "/" + lib.info.dispatcherXml,
        "-d"
    ], {
        cwd: lib.info.stormHome,
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
