
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

    var create_bucket = function(name, ram, replica, type) {

        ram = ram || 200;
        replica = replica || 1;
        type = type || "couchbase";

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

                return Promise.all(bucketNeeded).map(create_bucket);
            })

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

            return new Promise(function(ok, no) {

                console.log("Create External Cluster Reference");
                // http://docs.couchbase.com/admin/admin/REST/rest-xdcr-data-encrypt.html

                var data = {
                    name: "serviolastic",
                    hostname: "localhost:9091",
                    username: component.info.user,
                    password: component.info.password,
                };


                var h = { "content-type": "application/x-www-form-urlencoded" };
                _request(component.info.url_cluster + "/pools/default/remoteClusters", "POST", data, h, function(res) {

                    if(res instanceof Error) return no(res);

                    console.log(res);

                    console.log("Create Remote cluster");

                    var data = {
                        fromBucket: "soupdates",
                        toCluster: "serviolastic",
                        toBucket: "soupdates",
                        replicationType: "continuous",
                        type: "capi"
                    };

                    _request(component.info.url_cluster + "/controller/createReplication", "POST", data, h, function(res) {

                        if(res instanceof Error) return no(res);

                        console.log(res, typeof res);

                        var data  = {
                            fromBucket: "subscriptions",
                            toCluster: "serviolastic",
                            toBucket:"subscriptions",
                            replicationType: "continuous",
                            type: "capi"
                        };

                        _request(component.info.url_cluster + "/controller/createReplication", "POST", data, h, function(res) {

                            console.log(res, typeof res);

                            if(res instanceof Error) return no(res);

                            ok();

                        });

                    });
                });

            });

        })

        .then(success)
        .catch(fail)
        .finally(function() {
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

                    console.log("alias set");
                    return ok();
                });

            });

        });
};