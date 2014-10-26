
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

                console.log(response);

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

                restler.request(component.info.url + "/serviceobjects/_design/user", {

                    method: "PUT",
                    body: JSON.stringify(views.user),
                    username: component.info.user,
                    password: component.info.password,

                }).on("complete", function(res){

                    if(res instanceof Error) return no(res);

                    restler.request(component.info.url + "/serviceobjects/_design/index", {

                        method: "PUT",
                        body: JSON.stringify(views.index),
                        username: component.info.user,
                        password: component.info.password,

                    }).on('complete', function(res) {

                        if(res instanceof Error) return no(res);

                        ok()
                    })
                });

            });
        })

        .then(success)
        .catch(fail)
};