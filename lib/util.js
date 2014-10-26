var lib = module.exports = {};

var Promise = require('bluebird');
var child_process = require('child_process');

var DEBUG = true;
//DEBUG = false;

var d = function() {DEBUG && console.log.apply(console, arguments); };

lib.execute = function(command, args, options) {

    d("Executing " + command);

    args = args || [];
    options = options || {};

    return new Promise(function(OK, NO) {

        var process = child_process.spawn(command, args, options);

        process.stderr.on('data', function(raw) {
            d(raw.toString());
        });

        var rawdata = "";
        process.stdout.on('data', function(raw) {
            d(raw.toString());
            rawdata += raw.toString();
        });

        process.on('close', function(code) {

            d("Process exited with code " + code);
            if(code === 0) {

                setTimeout(function() {
                    OK(rawdata);
                }, 500);

            }
            else {
                NO(new Error("Cannot run " + command));
            }
        });

    });
};

lib.launch = function(command, args, options, waitFor) {

    waitFor = waitFor || 1500;

    d("Launching " + command);

    args = args || [];
    options = options || {  };

    options.detached = true;
    options.stdio = 'ignore';

    return new Promise(function(OK, NO) {

        var process = child_process.spawn(command, args, options);
//        process.stderr.on('data', function(raw) {
//            d(raw.toString());
//        });

//        var rawdata = "";
//        process.stdout.on('data', function(raw) {
//            d(raw.toString());
//            rawdata += raw.toString();
//        });

        setTimeout(function() {
            process.unref();
//            OK(rawdata);
            OK();
        }, waitFor);

    });
};

lib.ps = function(search_pattern) {

    var running = false;
    var found = false;
    var failed = false;

    var me = this;
    return new Promise(function(OK, NO) {

        var psaux = child_process.spawn("ps", ["aux"], {
            // options
        });

        var processes = [];
        psaux.stdout.on('data', function(raw) {
            var __processes = raw.toString().split("\n");
            processes = processes.concat(__processes);
        });

        var _parse = function() {

            var len = processes.length, cnt = 0;
//            d("Avai lines " + len);

            var _complete = function() {

                cnt++;
//                d(cnt, len)
                if(len === cnt) {
                    d("Process not found");
                    OK(running);
                }
            };

            !processes.length && OK(false);

            processes.forEach(function(line) {

                if(found) return;

                var pattern = "([^ ]+) *([0-9]+) *.*";
                pattern += search_pattern;

                var reg = new RegExp(pattern, "i");
                var res = line.match(reg);
                if(res) {

                    var user = res[1];
                    var pid = res[2];
                    d("Found a matching instance with user %s and pid %s", user, pid);

                    found = running = true;
                    OK(running, res, processes);
                }

                _complete();
            });

        };

        psaux.on('close', function(code) {
            if(code !== 0) {
                failed = true;
                NO(new Error("Cannot run `ps aux`"));
            }
            else {
                setTimeout(function() {
                    _parse();
                }, 500);
            }
        });

    });
};

lib.netstat = function(search_pattern) {

    var running = false;
    var found = false;
    var failed = false;

    var me = this;
    return new Promise(function(OK, NO) {

        var psaux = child_process.spawn("netstat", ["-nat"], {
            // options
        });

        var processes = [];
        psaux.stdout.on('data', function(raw) {
            var __processes = raw.toString().split("\n");
            processes = processes.concat(__processes);
        });

        var _parse = function() {

            var len = processes.length, cnt = 0;
//            d("Avai lines " + len);

            var _complete = function() {

                cnt++;
//                d(cnt, len)
                if(len === cnt) {
                    d("Ports not found");
                    OK(running);
                }
            };

            !processes.length && OK(false);

            processes.forEach(function(line) {

                if(found) return;

                var pattern = search_pattern;

                var reg = new RegExp(pattern, "i");
                var res = line.match(reg);
                if(res) {
                    found = running = true;
                    OK(running, reg);
                }

                _complete();
            });

        };

        psaux.on('close', function(code) {
            if(code !== 0) {
                failed = true;
                NO(new Error("Cannot run `ps aux`"));
            }
            else {
                setTimeout(function() {
                    _parse();
                }, 500);
            }
        });

    });
};


lib.watchPort = function(port, maxWait) {

    d("Watching port " + port);

    maxWait = maxWait || (60 * 1000);
    var waitedFor = 0;
    var interval = 1000;
    var _found = false;

    return new Promise(function(OK, NO) {

        var _intv = setInterval(function() {

            d("Checking..");
            lib.netstat(":"+port+"[ ]*.*LISTEN").then(function(found, regRes) {

                d((found ? "" : "not ") + "found!");

                if(found) {
                    _found = found;
                    clearInterval(_intv);
                    OK(true, regRes);
                }
            });

            waitedFor += interval;
            if(waitedFor >= maxWait) {

                !_found && d("Not found but reached max wait time. Failed to startup?");
                !_found && NO(false, []);

                _found && OK(true, []);

                clearInterval(_intv);

            }

        }, interval);

    });
};