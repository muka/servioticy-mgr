
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

            // http://docs.couchbase.com/admin/admin/Install/hostnames.html
            // curl -v -X POST -u admin:password http://127.0.0.1:8091/node/controller/rename -d hostname=servioticy.local
            console.log("Setting hostname alias to " + component.info.hostnameAlias);

            var _url = component.info.url + "/node/controller/rename";

            return _promiseRequest(_url, "POST", JSON.stringify({ hostname: component.info.hostnameAlias }))
                    .then(function(res) {

                        component.info.url = component.info.url.replace('localhost', component.info.hostnameAlias);
                        component.info.url_cluster = component.info.url_cluster.replace('localhost', component.info.hostnameAlias);

                        console.log("alias set, using  " + component.info.url);

                        return Promise.resolve();
                    }).catch(function(err) {

                        console.log("** Error setting alias!", err);

                        return Promise.reject(err);
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
                var taskList = component.info.url_cluster + "/pools/default/tasks";

                var listXDCR = function() {
                    return _promiseRequest(urlClusterApi, "GET", null, {});
                };

                var destinationCluster = {
                    create: function() {

                        var _host = (component.info.url_cluster.match(/localhost/)) ? 'localhost' : component.info.hostnameAlias;

                        console.log("Creating cluster %s at %s", component.info.xdcr.name, _host+ ":"+ component.info.xdcr.port);

                        var h = {
                            "content-type": "application/x-www-form-urlencoded"
                        };

                        var data = {
                            name: component.info.xdcr.name,
                            hostname: _host + ":" + component.info.xdcr.port,
                            username: component.info.user,
                            password: component.info.password,
                        };

                        return _promiseRequest(urlClusterApi, "POST", data, h);
                    },
                    remove: function(cluster) {

                        console.log("Deleting cluster " + cluster.name + " with uuid " + cluster.uuid);

                        var h = {
                            "content-type": "application/x-www-form-urlencoded"
                        };

                        // http://docs.couchbase.com/admin/admin/REST/rest-xdcr-intro.html
                        // http://docs.couchbase.com/admin/admin/REST/rest-xdcr-delete-ref.html
                        var _uri = urlClusterApi + "/" + cluster.name;

                        return _promiseRequest(_uri, "DELETE", {}, h);
                    }
                };

                var replication = {
                    create: function(data) {

                        console.log("Creating replication of %s to %s.%s", data.fromBucket, data.toCluster, data.toBucket);

                        var h = {
                            "content-type": "application/x-www-form-urlencoded"
                        };

                        return _promiseRequest(component.info.url_cluster + "/controller/createReplication", "POST", data, h);
                    },
                    remove: function(cluster, replica) {

                        console.log("Deleting replica from " + component.info.xdcr.name + " of "  + replica.toBucket + " with uuid " + cluster.uuid);

                        var h = {
                            "content-type": "application/x-www-form-urlencoded"
                        };

                        // http://docs.couchbase.com/admin/admin/REST/rest-xdcr-delete-replication.html
                        // eg [uuid]%2F[local-bucket-name]%2F[remote-bucket-name]
                        // eg /controller/cancelXDCR/2cf47a1c85c532768aeb540b7a02ff57%2Fsubscriptions%2Fsubscriptions

                        var _uri = component.info.url_cluster + "/controller/cancelXDCR/"
                                    + cluster.uuid + "%2F"
                                    + replica.fromBucket + "%2F"
                                    + replica.toBucket;
                        console.log("DELETE " + _uri);

                        return _promiseRequest(_uri, "DELETE", {}, h);
                    },
                };

                return listXDCR().then(function(rawres) {

                    var _createXDCR = function() {
                        return destinationCluster.create()
                            .then(function(raw) {

                                console.log("Result", raw);

                                var bucketsReplica = component.info.xdcr.replica;
                                return Promise.all(bucketsReplica).map(replication.create)
                            })
                            .then(function(raw) {
                                console.log("Result for replication", raw);
                                return Promise.resolve();
                            });
                    };

                    var _removeXDCR = function() {

                        var bucketsReplica = component.info.xdcr.replica;

                        return Promise.all(bucketsReplica).map(function(replica) {
                            return replication.remove(replicaInfo, replica);
                        })
                        .then(function(raw) {
                            console.log("Result", raw);
                            return destinationCluster.remove(replicaInfo);
                        })
                        .then(function(raw) {
                            console.log("Result", raw);
                            return Promise.resolve();
                        });
                    };

                    var res = JSON.parse(rawres);
                    if(res.length) {

                        var list = [];

                        for(var i in res) {
                            var replicaInfo = res[i];
                            if(replicaInfo.name === component.info.xdcr.name) {
                                console.log("Removing replica for " + component.info.xdcr.name);
                                list.push(replicaInfo);
                            }
                        }

                        if(list.length) {
                            return Promise.all(list)
                                .map(_removeXDCR)
                                .then(function(res) {
                                    console.log("Res", res);
                                    return _createXDCR();
                                });
                        }

                    }

                    return _createXDCR();

                }).then(ok).catch(ko);

            })

        })

        .then(success)
        .catch(fail)
        .finally(function() {
            console.log("Completed");
        });
};