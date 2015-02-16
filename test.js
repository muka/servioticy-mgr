
var restler = require('restler');

var b = {"views":{"byIndex":{"map":"function (doc, meta) { emit(meta.id, null); }"}}}



var _request = function(url, method, data, then) {
    console.log(data);
    restler.request(url, {
        headers: {
           'content-type': 'application/json'
       },
        method: method || "GET",
        data: data,
        username: "admin",
        password: "password",

    }).on('complete', then);

}


_request("http://localhost:8092/serviceobjects/_design/user","PUT", JSON.stringify(b), function(res) {

    console.log(res);
});
