var lib = module.exports;

var Promise = require('bluebird');
var child_process = require('child_process');
var restler = require('restler');
var _ = require('underscore');

var DEBUG = process.env.DEBUG || false;

var logger;

var d = function() {
    logger = logger || lib.logger("util");
    logger.debug.apply(logger, arguments);
};

lib.logger = function(prefix) {

    var _log = function(k, args) {

        var l = [ "  [" + (prefix || " » ") + "]\t" ];
        for(var i=0; i < args.length; i++ ) {

            if(i === 0 && (typeof args[i] === 'string' && args[i].indexOf("%s") > -1))
            {
                l[0] += args[i];
                continue;
            }

            l.push( args[i] );
        }

        DEBUG && console.log.apply(console, l);
    };

    return {
        verbose: function() {
            _log("verbose", arguments);
        },
        debug: function() {
            _log("debug", arguments);
        },
        notice: function() {
            _log("notice", arguments);
        },
        info: function() {
            _log("info", arguments);
        },
        log: function() {
            _log("log", arguments);
        },
        warn: function() {
            _log("warn", arguments);
        },
        error: function() {
            _log("error", arguments);
        }
    };
};

lib.request = function(url, data, headers, method) {

    var username = null,
        password = null;

    if(arguments.length === 2) {
        if(url && data.method || data.headers || data.data) {

            method = data.method;
            headers = data.headers;

            if(data.username) {
                username = data.username;
            }

            if(data.password) {
                password = data.password;
            }

            data = data.data;

        }
    }

    headers = headers || {};

    if(headers.username) {
        username = headers.username;
        delete headers.username;
    }

    if(headers.password) {
        username = headers.password;
        delete headers.password;
    }

    var opts = {

        method: method || 'GET',
        data: data || null,

        headers: Object.keys(headers).length ? headers : null,

        username: username,
        password: password
    };

    var Promise = require('bluebird');
    return new Promise(function(ok, ko) {

        var restler = require('restler');
        restler.request(url, opts).on('complete', function(res) {

            if(res instanceof Error) {
                return ko(res);
            }

            ok(res);
        });
    });
};

lib.execute = function(command, args, options) {

    d("Executing " + command + " ["+ args.join(', ') +"]");

    args = args || [];
    options = options || {};

    return new Promise(function(OK, NO) {

        var process = child_process.spawn(command, args, options);

        process.stderr.on('data', function(raw) {
            d(raw.toString());
        });

        var rawdata = "";
        process.stdout.on('data', function(raw) {
//            d(raw.toString());
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
//        });

        setTimeout(function() {
            d("process pid %s", process.pid);
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
    
    d("Looking for process pattern " + search_pattern);
    
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
                    OK(running, [], "");
                }
            };

            !processes.length && OK(false);

            var pattern = "^([a-z0-9+]+) *([0-9]+) *.*";
            pattern += search_pattern + ".*";

//            d("Pattern " + pattern);

            processes.forEach(function(line) {

                if(found) return;

                
                var reg = new RegExp(pattern, "i");
                var res = line.match(reg);
                if(res) {
                    
                    var user = res[1];
                    var pid = res[2];
                    
                    if(pid*1 === process.pid) {
                        // current command, skip it
//                        d("Found my own pid %s = %s", process.pid, pid);
                        return OK(false);
                    }
                    
                    d("Found a matching instance with user %s and pid %s", user, pid);
//                    d(res[0]);
                    

                    found = running = true;
                    OK({
                        user: user,
                        pid: pid ,
                        raw: processes,
                        __res: res
                    }, res, processes);
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

lib.kill = function(pids) {

    if(!pids || !pids.length) {
        return Promise.resolve();
    }

    if(!(pids instanceof Array)) {
        pids = [ pids ];
    }

    d("Killing pids " +  pids.join(', '));
    return Promise.all(pids).map(function(pid) {
        
        if(pid == process.pid) {
            // current command, skip it
//            d("Skip my own pid %s = %s", process.pid, pid);
            return Promise.resolve();
        }        
        
        return lib.execute("kill", ['-9', pid]);
    });
};

lib.foreverProcess = function(script_name) {
    return lib.execute('forever', [ 'list' ]).then(function(raw) {

        var reg = new RegExp(".*\\[([0-9]+)\\].*"+ script_name, "i");
        var list = raw.split("\n");
        var found = false;

        list.forEach(function(line) {

            if(found !== false) return;

            var r = line.match(reg);
            if(r) {
                found = {
                    id: r[1],
                    line: line,
                    raw: raw
                };
            }
        });

        return Promise.resolve(found);
    });
};