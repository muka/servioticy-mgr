servioticy-mgr
==============

Minimal service manager for servioticy.

Intended to be used with https://github.com/servioticy/servioticy-vagrant

**Not stable, but works**

##Install

`sudo npm i -g muka/servioticy-mgr`

##Usage

`sudo servioticy start`

`sudo servioticy stop`

`sudo servioticy restart`

`sudo servioticy status`


###Per service

List managed services:

`sudo servioticy services`

Start elastic search

`sudo servioticy start elasticsearch`

Is node bridge up?

`sudo servioticy status bridge`


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

##License

Apache2

