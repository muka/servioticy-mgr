
var restler = require('restler');

var indexes = require('./indexes.json');

module.exports.run = function(component, success, fail) {

    var keys = Object.keys(indexes);
    var len = keys.length, cnt = 0;
    var _failed = false;

    var _createCouchbaseDocTemplate = function() {

        var options = {
            headers: {},
            method: "POST",
            data: JSON.stringify(require('./couchbase_template.json'))
        };

        console.log("Creating template for couchbase");
        restler.request(component.info.url + "/_template/couchbase", options).on("complete", function(res) {

            var xfailed = false;

            try {
                xfailed = JSON.parse(res);
                xfailed = xfailed.error;
            }
            catch(e) {}

            if(res instanceof Error || xfailed) return fail(res);

            console.log("ok", res);
            success();
        });
    };

    var _check = function(err, res) {

        if(err) {
            _failed = true;
            fail(err);
            return;
        }

        cnt++;
        if(cnt === len) {
            !_failed && _createCouchbaseDocTemplate();
        }
    };


    var _req = function(method, name, then, __then) {

        var body = null;
        if(typeof __then === 'function') {
            body = then;
            then = __then;
        }

        then = then || function(err, res) {
            if(err) throw err;
        };

        var options = {
            headers: {},
            method: method,
            data: body,
        };

        restler.request(component.info.url + "/" + name + "/", options).on("complete", then);
    };

    var Index = {
        exists: function(name, then) {
            _req("HEAD", name, then);
        },
        delete: function(name, then) {
            _req("DELETE", name, then);
        },
        create: function(name, body, then) {
            _req("PUT", name, body, then);
        }
    };

    keys.forEach(function(name) {

        if(_failed) return;

        Index.exists(name, function(res) {

            if(res.statusCode === 200) {

                Index.delete(name, function(res) {

                    console.log(res);
                    if(res instanceof Error) throw res;

                    Index.create(name, indexes[name], function(res) {
                        if(res instanceof Error) throw res;
                        console.log(res);
                        _check();
                    });
                });
            }
            else {

                Index.create(name, indexes[name], function(res) {
                    if(res instanceof Error) throw res;
                    console.log(res);
                    _check();
                });
            }

        });

    });

};