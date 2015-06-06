var lib = module.exports = {};

var Promise = require('bluebird');
var child_process = require('child_process');

var util = require('../lib/util');

lib.info = {

    name: "tomcat",
    priority: 210,
    
    command: "/etc/init.d/tomcat7",

    url: "http://localhost:8080",
    waitPort: 8080,
};

lib.setup = function(component) {
    return Promise.resolve();
};

lib.ready = function() {
    var check_port = lib.info.waitPort;
    return util.watchPort(check_port);
};

lib.status = function() {
    var search_pattern = "catalina.*tomcat";
    return util.ps(search_pattern);
};

lib.start = function() {
    var op = "start";
    return util.execute(lib.info.command, [op]);
};

lib.stop = function() {
    var op = "stop";
    return util.execute(lib.info.command, [op]);
};
