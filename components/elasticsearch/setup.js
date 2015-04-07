
var restler = require('restler');
var Promise = require('bluebird');
var util = require('../../lib/util');

var logger = util.logger("elasticsearch");

module.exports.run = function(component, success, fail) {

    var restartCouchbaseXdcr = function() {
        return new Promise(function(ok, ko) {

            if(component.lib.forceSetup) {

                var couchbaseComp = require('../couchbase');
                var couchbaseSetup = require('../couchbase/setup');

                return couchbaseSetup.replicaSetup(couchbaseComp).then(ok).catch(ko);
            }

            return ok();
        });
    };


    var createCouchbaseDocTemplate = function() {

        var options = {
            headers: {},
            method: "POST",
            data: JSON.stringify(require('./couchbase_template.json'))
        };

        var uri = component.info.url + "/_template/couchbase";

        logger.debug("Creating template for couchbase");
        return util.request(uri, options);
    };


    var createIndexes = function() {

        var _indexes = require('./indexes.json');

        var _req = function(method, name, body) {

            var options = {
                headers: {},
                method: method,
                data: body
            };

            return util.request(component.info.url + "/" + name + "/", options);
        };

        var Index = {
            exists: function(name) {
                return _req("HEAD", name);
            },
            delete: function(name) {
                logger.debug("Removing index %s", name);
                return _req("DELETE", name);
            },
            create: function(name, body) {
                logger.debug("Creating index %s", name);
                return _req("PUT", name, body);
            }
        };

        return Promise.all(Object.keys(_indexes)).each(function(name) {

            logger.debug("Delete index %s", name);
            return Index.delete(name).then(function(res) {

                logger.debug("Create index %s", name);
                return Index.create(name, _indexes[name], function(res) {

                    logger.debug("Ok for %s", name);
                    return Promise.resolve();
                });
            });
        });

    };

    return createIndexes()
            .then(createCouchbaseDocTemplate)
            .then(restartCouchbaseXdcr);
};