var lib = module.exports = {};

var Promise = require('bluebird');
var child_process = require('child_process');

var util = require('../lib/util');

lib.info = {

    // disabled in security branch
    disabled: true,

    name: "userDB",
    priority: 150,

    cwd: "/data/userDB",
    command: "python",
    args: [ "userDB.py" ],

    url: "http://localhost:8080",

    waitPort: 5010,
};

lib.setup = function(component) {
    return Promise.resolve();
};

lib.ready = function() {
    var check_port = lib.info.waitPort;
    return util.watchPort(check_port);
};

lib.status = function() {
    var search_pattern = "python userDB.py";
    return util.ps(search_pattern);
};

lib.start = function() {
    var op = "run";
    return util.launch(lib.info.command, lib.info.args, {
        cwd: lib.info.cwd
    }, 2500);
};

lib.stop = function() {
    return lib.status().then(function(running) {

        if(!running || !running.pid) {
            return Promise.resolve();
        }

        return util.kill(running.pid);
    });
};
