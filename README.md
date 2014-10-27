servioticy-mgr
==============

Minimal service manager for servioticy

**Not stable, but works**

Usage:

`./bin/service start`

`./bin/service stop`

`./bin/service restart`

`./bin/service status`

###Per service

`./bin/service start elasticsearch`

###Avail services

- userDB
- storm
- kestrel
- jetty
- elasticsearch
- couchbase
- bridge
- apollo

###Adding more services

See `./components/` js for an overview of how to add other components.

priority indicates the order of startup (where lower comes first)

###License

Apache2

