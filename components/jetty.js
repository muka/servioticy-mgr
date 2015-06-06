var lib = module.exports = {};

var Promise = require('bluebird');
var child_process = require('child_process');

var util = require('../lib/util');

lib.info = {
    
    // disabled in favour of tomcat
    disabled: true,
    
    name: "jetty",
    priority: 200,
    
    command: "/etc/init.d/jetty",

    url: "http://localhost:8070",
    waitPort: 8070,
};

lib.setup = function(component) {
    return Promise.resolve();
};

lib.ready = function() {
    var check_port = lib.info.waitPort;
    return util.watchPort(check_port);
};

lib.status = function() {
    var search_pattern = "jetty\/start.jar";
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
