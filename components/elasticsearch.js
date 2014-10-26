var lib = module.exports = {};

var Promise = require('bluebird');
var child_process = require('child_process');

var util = require('../lib/util');

lib.info = {
    name: "elasticsearch",
    priority: 90,
    command: "/etc/init.d/elasticsearch-serviolastic",
    url: 'http://localhost:9200',
    waitPort: 9200,
};

lib.setup = function(component) {
    var es_setup = require('./elasticsearch/setup');
    return new Promise(function(s,f) {
        es_setup.run(component, s, f);
    });
};

lib.status = function() {
    var search_pattern = "bin.java.*elasticsearch";
    return util.ps(search_pattern);
};

lib.ready = function() {
    var check_port = lib.info.waitPort;
    return util.watchPort(check_port);
};

lib.start = function() {
    var op = "start";
    return util.execute(lib.info.command, [op])
};

lib.stop = function() {
    var op = "stop";
    return util.execute(lib.info.command, [op]);
};
