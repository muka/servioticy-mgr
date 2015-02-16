
var Promise = require('bluebird');
var restler = require('restler');

var util = require('../../lib/util');

module.exports.run = function(component, success, fail) {

    var couchbase_cli = function(command, opts) {

        opts = opts || [];

        var args = [

            command,

            "--cluster=" + component.info.cluster,
            "--user=" + component.info.user,
            "--password=" + component.info.password,

        ];

        args = args.concat(opts);

//        console.log("ARGS");console.log(args);

        return util.execute("/opt/couchbase/bin/couchbase-cli", args);
    };

    var create_bucket = function(opts) {

        var name = opts.name;

        if(typeof opts === 'string') {
            name = opts;
            opts = {};
        }

        var ram = opts.ram || 200;
        var replica = opts.replica || 1;
        var type = opts.type || "couchbase";

        console.log("Create bucket " + name);
        return couchbase_cli("bucket-create", [
            "--bucket-type=" + type,
            "--bucket-ramsize=" + ram,
            "--bucket-replica=" + replica,
            "--bucket=" + name,
        ]);
    };

    var _request = function(url, method, data, h, then) {

        if(typeof h === 'function') {
            then = h;
            h = { 'Content-Type': 'application/json' };
        }

        restler.request(url, {

            method: method || "GET",
            data: data || null,
            headers: h,
            username: component.info.user,
            password: component.info.password,

        }).on('complete', then);

    };

    var _promiseRequest = function(url, method, data, h) {
        return new Promise(function(ok, ko) {
            _request(url, method, data, h, function(res) {
                if(res instanceof Error) return ko(res);
                return ok(res);
            });
        });
    };

    console.log("Node initialization");
    couchbase_cli("node-init", [ "--node-init-data-path=" + component.info.dataPath ])

        .then(function() {
            console.log("Instance initialization");
            return couchbase_cli("cluster-init", [
                "--cluster-init-username=" + component.info.user,
                "--cluster-init-password=" + component.info.password,
                "--cluster-init-ramsize=1200",
            ])
        })
        .then(function() {
            return couchbase_cli("bucket-list").then(function(response) {

//                console.log(response);

                var list = response.split("\n");
                var bucketsAvail = {};
                list.forEach(function(line) {
                    var el = line.match(/([a-z0-9]+)/i);
                    if(el) {
                        bucketsAvail[el[1]] = el[1];
                    }
                });

                var bucketNeeded = [];
                component.info.buckets.forEach(function(bucket) {
                    if(!bucketsAvail[bucket]) {
                        bucketNeeded.push(bucket);
                    }
                });

                return Promise.all(bucketNeeded).map(function(name) {
                    return create_bucket(name);
                });
            })

        })
        .then(function() {
            return new Promise(function(ok, ko) {

                // http://docs.couchbase.com/admin/admin/Install/hostnames.html
                // curl -v -X POST -u admin:password http://127.0.0.1:8091/node/controller/rename -d hostname=servioticy.local
                console.log("Setting hostname alias to " + component.info.hostnameAlias);
                _request(component.info.url + "/node/controller/rename",
                            "POST", JSON.stringify({ hostname: component.info.hostnameAlias }), function(res) {

                    if(res instanceof Error) {
                        console.log("Error setting alias");
                        return ko();
                    }

                    component.info.url = component.info.url.replace('localhost', component.info.hostnameAlias);
                    component.info.url_cluster = component.info.url_cluster.replace('localhost', component.info.hostnameAlias);

                    console.log("alias set, using  " + component.info.url);
                    return ok();
                });

            });

        })
        .then(function() {

            var views = component.info.views;

            return new Promise(function(ok, no) {
                console.log("Creating views");

                _request(component.info.url + "/serviceobjects/_design/user",
                    "PUT", JSON.stringify(views.user), function(res) {

                    console.log(res);

                    if(res instanceof Error) return no(res);

                    _request(component.info.url + "/serviceobjects/_design/index",
                        "PUT", JSON.stringify(views.index), function(res) {

                        console.log(res);

                        if(res instanceof Error) return no(res);

                        ok();
                    })
                });

            });
        })

        .then(function() {

            return new Promise(function(ok, ko) {

                console.log("Create External Cluster Reference");
                // http://docs.couchbase.com/admin/admin/REST/rest-xdcr-data-encrypt.html


                var urlClusterApi = component.info.url_cluster + "/pools/default/remoteClusters";

                var listXDCR = function() {
                    return _promiseRequest(urlClusterApi, "GET", null, {});
                };

                var createXDCR = function() {

                    console.log("Creating replica " + component.info.xdcr.name);

                    var h = {
                        "content-type": "application/x-www-form-urlencoded"
                    };

                    var _host = (component.info.url_cluster.match(/localhost/)) ? 'localhost' : component.info.hostnameAlias;
                    var data = {
                        name: component.info.xdcr.name,
                        hostname: _host + ":" + component.info.xdcr.port,
                        username: component.info.user,
                        password: component.info.password,
                    };

                    return _promiseRequest(urlClusterApi, "POST", data, h);
                };

                var createDataReplica = function() {

                    var h = {
                        "content-type": "application/x-www-form-urlencoded"
                    };

                    var data  = {
                        fromBucket: "subscriptions",
                        toCluster: component.info.xdcr.name,
                        toBucket:"subscriptions",
                        replicationType: "continuous",
                        type: "capi"
                    };

                    console.log("Creating data replica for " + data.fromBucket);

                    return _promiseRequest(component.info.url_cluster + "/controller/createReplication", "POST", data, h);
                };

                return listXDCR().then(function(res) {

                    if(!res.length) {
                        return createXDCR().then(createDataReplica);
                    }
                    else {
                        console.log("Reference already existing for " + component.info.xdcr.name);
                    }

                    return Promise.resolve();
                }).then(ok).catch(ko);

            })

        })

        .then(success)
        .catch(fail)
        .finally(function() {
            console.log("Completed");
        });
};