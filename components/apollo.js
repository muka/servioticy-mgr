var lib = module.exports = {};

var Promise = require('bluebird');
var child_process = require('child_process');

var util = require('../lib/util');

lib.info = {

    name: "apollo",
    priority: 150,
    command: "/opt/servibroker/bin/apollo-broker",

    url: "http://localhost:8080",

    waitPort: 61680,
};

lib.setup = function(component) {
    return Promise.resolve();
};

lib.ready = function() {
    var check_port = lib.info.waitPort;
    return util.watchPort(check_port);
//    return Promise.resolve();
};

lib.status = function() {
    var search_pattern = "servibroker";
    return util.ps(search_pattern);
};

lib.start = function() {
    var op = "run";
    return util.launch(lib.info.command, [op], {}, 5000);
};

lib.stop = function() {

    return util.execute("ps", ["aux"]).then(function(raw) {

        var pattern = /([a-z0-9]+)[ ]*([a-z0-9]+)[ ]*.*servibroker/i;
        var pids = [];

        var response = raw.split("\n");
        response && response.forEach(function(line) {

            var r = line.match(pattern);
            if(r) {
                pids.push(r[2]);
            }

        });

        if(!pids.length) {
            return Promise.resolve();
        }

        return Promise.all(pids).map(function(pid) {
            return util.execute("kill", [ "-9", pid ]);
        });
    })
};
