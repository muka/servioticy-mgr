
var restler = require('restler');

var indexes = require('./indexes.json');

module.exports.run = function(component, success, fail) {

    var keys = Object.keys(indexes);
    var len = keys.length, cnt = 0;
    var _failed = false;

    var _check = function(err, res) {

        console.log(err);

        if(err) {
            _failed = true;
            fail(err);
            return;
        }

        cnt++;
        if(cnt === len) {
            !_failed && success();
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
            body: body,
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

        Index.exists(name, function(err, res) {

            if(res.statusCode === 200) {

                Index.delete(name, function(err, res) {

                    if(err instanceof Error) throw err;

                    Index.create(name, indexes[name], function(err, res) {
                        if(err instanceof Error) throw err;
                        _check();
                    });
                });
            }
            else {

                Index.create(name, indexes[name], function(err, res) {
                    if(err instanceof Error) throw err;
                    _check();
                });
            }

        });

    });

};