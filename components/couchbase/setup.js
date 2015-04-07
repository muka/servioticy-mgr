
var Promise = require('bluebird');
var restler = require('restler');

var util = require('../../lib/util');

var logger = util.logger("couchbase");

var lib = module.exports;

lib.replicaSetup = function(component) {

    logger.debug("Create External Cluster Reference");
    // http://docs.couchbase.com/admin/admin/REST/rest-xdcr-data-encrypt.html

    var urlClusterApi = component.info.url_cluster + "/pools/default/remoteClusters";
    var taskList = component.info.url_cluster + "/pools/default/tasks";

    var defaultHeaders = {
        "content-type": "application/x-www-form-urlencoded"
    };

    var request = function(url, opts) {
        opts = opts || {};
        return util.request(url, {
            method: opts.method || 'GET',
            headers: opts.headers || defaultHeaders,
            data: opts.data || {},
            username: component.info.user,
            password: component.info.password
        });
    };

    var destinationCluster = {
        getHost: function() {
            var _host = (component.info.url_cluster.match(/localhost/)) ? 'localhost' : component.info.hostnameAlias;
            return component.info.xdcr.host || _host;
        },
        create: function() {

            var _host = destinationCluster.getHost();
            component.info.xdcr.host = component.info.xdcr.host || _host;

            logger.debug("Creating cluster %s at %s", component.info.xdcr.name, _host+ ":"+ component.info.xdcr.port);

            var data = {
                name: component.info.xdcr.name,
                hostname: component.info.xdcr.host + ":" + component.info.xdcr.port,
                username: component.info.user,
                password: component.info.password
            };

            var _uri = component.info.url + "/pools/default/remoteClusters";

            return request(_uri, { method: "POST", data: data });
        },
        remove: function(cluster) {

            // http://docs.couchbase.com/admin/admin/REST/rest-xdcr-intro.html
            // http://docs.couchbase.com/admin/admin/REST/rest-xdcr-delete-ref.html

            var _uri = component.info.url_cluster + "/pools/default/remoteClusters/" + cluster.name;

            logger.debug("Deleting cluster %s with uuid %s", cluster.name , cluster.uuid);
            logger.debug("DELETE %s", _uri);

            return request(_uri, { method: "DELETE" });
        }
    };

    var replication = {
        create: function(data) {

            var url = component.info.url + "/controller/createReplication";

            logger.debug("Creating replication of %s to %s.%s", data.fromBucket, data.toCluster, data.toBucket);
            logger.debug("POST %s", url);

            return request(url, { method: "POST", data: data });
        },
        remove: function(cluster, replica) {

            logger.debug("Deleting replica from %s of %s with uuid %s", component.info.xdcr.name, replica.toBucket, cluster.uuid);

            // http://docs.couchbase.com/admin/admin/REST/rest-xdcr-delete-replication.html
            // eg [uuid]%2F[local-bucket-name]%2F[remote-bucket-name]
            // eg /controller/cancelXDCR/2cf47a1c85c532768aeb540b7a02ff57%2Fsubscriptions%2Fsubscriptions

            var _uri = component.info.url_cluster + "/controller/cancelXDCR/"
                        + cluster.uuid + "%2F"
                        + replica.fromBucket + "%2F"
                        + replica.toBucket;

            // DELETE http://servioticy.local:8091/pools/default/remoteClusters/serviolastic
            logger.debug("DELETE %s", _uri);

            return request(_uri, { method: "DELETE", header: {} });
        }
    };


    var XDCR = {
        create: function() {
            return destinationCluster.create()
                .then(function(raw) {

                    logger.debug("XDCR.create result", raw);

                    var bucketsReplica = component.info.xdcr.replica;
                    return Promise.all(bucketsReplica).each(replication.create)
                })
                .then(function(rawList) {

                    logger.debug("Completed replication");
                    return Promise.resolve();
                });
        },
        remove: function(replicaInfo) {

            logger.debug("Remove replica %s", replicaInfo.name);

            var bucketsReplica = component.info.xdcr.replica;

            return Promise.all(bucketsReplica).map(function(replica) {

                return replication.remove(replicaInfo, replica);
            })
            .then(function(raw) {

                logger.debug("Ok", raw);
                logger.debug("Removing cluster %s", replicaInfo.name);

                return destinationCluster.remove(replicaInfo);
            })
            .then(function(raw) {
                logger.debug("Ok", raw);
                return Promise.resolve();
            })
            .catch(function(ex) {
                logger.debug("Exception ", ex);
                return Promise.reject(ex);
            });
        },
        list: function() {
            return request(urlClusterApi);
        }
    };


    return XDCR.list().then(function(rawres) {

        var res;
        try {
            res = JSON.parse(rawres);
        }
        catch(e) {

            logger.debug("Error parsing", rawres.length ? "empty response" : rawres);
            logger.error(e);

            res = false;
        }

        if(res && res.length) {

            var list = [];

            Object.keys(res).forEach(function(i) {

                var replicaInfo = res[i];
                if(replicaInfo.name === component.info.xdcr.name) {
                    logger.debug("Removing replica for " + component.info.xdcr.name);
                    list.push(replicaInfo);
                }

            });

            if(list.length) {

                logger.debug("Removing local %s avail replication", list.length);

                return Promise.all(list)
                    .each(XDCR.remove)
                    .then(function(res) {
                        logger.debug("Ok", res);
                        return XDCR.create();
                    })
                    .catch(function(err) {
                        logger.debug("Error occured", err);
                        return Promise.reject(err);
                    });
            }

        }

        return XDCR.create();
    });
};

lib.run = function(component, success, fail) {

    var couchbase_cli = function(command, opts) {
        opts = opts || [];
        var args = [
            command,
            "--cluster=" + component.info.cluster,
            "--user=" + component.info.user,
            "--password=" + component.info.password
        ];
        args = args.concat(opts);
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

        logger.debug("Create bucket " + name);

        return couchbase_cli("bucket-create", [
            "--bucket-type=" + type,
            "--bucket-ramsize=" + ram,
            "--bucket-replica=" + replica,
            "--bucket=" + name,
        ]);
    };

    logger.debug("Node initialization");
    return couchbase_cli("node-init", [ "--node-init-data-path=" + component.info.dataPath ])

        .then(function() {
            logger.debug("Instance initialization");
            return couchbase_cli("cluster-init", [
                "--cluster-init-username=" + component.info.user,
                "--cluster-init-password=" + component.info.password,
                "--cluster-init-ramsize=1200",
            ])
        })

        .then(function() {
            return couchbase_cli("bucket-list").then(function(response) {

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

            logger.debug("Setting hostname alias to " + component.info.hostnameAlias);

            var _url = component.info.url + "/node/controller/rename";

            return util.request(_url, { method: "POST", data: JSON.stringify({ hostname: component.info.hostnameAlias }) })
                    .then(function(res) {

                        component.info.url = component.info.url.replace('localhost', component.info.hostnameAlias);
                        component.info.url_cluster = component.info.url_cluster.replace('localhost', component.info.hostnameAlias);

                        logger.debug("alias set, using  " + component.info.url);

                        return Promise.resolve();
                    }).catch(function(err) {
                        logger.debug("** Error setting alias!", err);
                        return Promise.reject(err);
                    });

        })
        .then(function() {

            var views = component.info.views;

            logger.debug("-------------------");
            logger.debug("Creating views");

            var opts = {
                method: "PUT",
                headers: { "content-type": "application/json" },
                data: JSON.stringify(views.user),
                username: component.info.user,
                password: component.info.password
            };
            var url = component.info.url2 + "/serviceobjects/_design/user";

            logger.debug("Creating serviceobjects.user view");
            logger.debug("%s %s %s", opts.method, url, opts.data);

            return util.request(url, opts).then(function(res) {

                opts.data = JSON.stringify(views.index);

                var url = component.info.url2 + "/serviceobjects/_design/index";

                logger.debug("Creating serviceobjects.index view");
                logger.debug("%s %s %s", opts.method, url, opts.data);

                return util.request(url, opts);
            });
        })

        .then(function() {
            logger.debug("-------------------");
            logger.debug("Setting up replica");
            return lib.replicaSetup(component);
        })

        .then(success)
        .catch(fail)

        .finally(function() {
            logger.debug("Completed");
        });
};