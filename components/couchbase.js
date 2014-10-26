var lib = module.exports = {};

var Promise = require('bluebird');
var child_process = require('child_process');

var util = require('../lib/util');

lib.info = {

    name: "couchbase",
    priority: 100,
    command: "/etc/init.d/couchbase-server",

    url: "http://localhost:8092",

    cluster: "localhost",
    user: "admin",
    password: "password",

    waitPort: 8091,
    dataPath: "/data/couchbase",

    buckets: [
        "serviceobjects",
        "privatebucket",
        "actuations",
        "soupdates",
        "subscriptions",
    ],

    views: {
        index: {"views":{"byIndex":{"map":"function (doc, meta) {\n emit(meta.id, null);\n } "}}},
        user: {"views":{"byUser":{"map":"function (doc, meta) {\n emit(doc.userId, meta.id);\n } "}}},
    }
};

lib.setup = function(component) {
    return new Promise(function(OK, NO) {
        return require('./couchbase/setup').run(component, OK, NO);
    });
};

lib.ready = function() {
    var check_port = lib.info.waitPort;
    return util.watchPort(check_port);
};

lib.status = function() {
    var search_pattern = "couchbase\/lib";
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
