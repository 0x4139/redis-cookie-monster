var tough = require('tough-cookie');
var redis = require('redis');
var Store = tough.Store;
var permuteDomain = tough.permuteDomain;
var permutePath = tough.permutePath;
var util = require('util');
var fs = require('fs');

function CookieMonster(id, opts) {
    if (!opts) throw new Error('Please pass the redis credentials');
    Store.call(this);
    this.id = id;
    this.repository = redis.createClient(opts.port, opts.host, opts.opts);
    this.idx = {}; // idx is memory cache
    var self = this;
    this.loadFromRepository(this.id, function(dataJson) {
        if (dataJson) self.idx = dataJson;
    });
}
util.inherits(CookieMonster, Store);
exports.CookieMonster = CookieMonster;
CookieMonster.prototype.idx = null;
CookieMonster.prototype.synchronous = true;
// force a default depth:
CookieMonster.prototype.inspect = function() {
    return "{ idx: " + util.inspect(this.idx, false, 2) + ' }';
};
CookieMonster.prototype.findCookie = function(domain, path, key, cb) {
    if (!this.idx[domain]) {
        return cb(null, undefined);
    }
    if (!this.idx[domain][path]) {
        return cb(null, undefined);
    }
    return cb(null, this.idx[domain][path][key] || null);
};
CookieMonster.prototype.findCookies = function(domain, path, cb) {
    var results = [];
    if (!domain) {
        return cb(null, []);
    }
    var pathMatcher;
    if (!path) {
        // null or '/' means "all paths"
        pathMatcher = function matchAll(domainIndex) {
            for (var curPath in domainIndex) {
                var pathIndex = domainIndex[curPath];
                for (var key in pathIndex) {
                    results.push(pathIndex[key]);
                }
            }
        };
    } else if (path === '/') {
        pathMatcher = function matchSlash(domainIndex) {
            var pathIndex = domainIndex['/'];
            if (!pathIndex) {
                return;
            }
            for (var key in pathIndex) {
                results.push(pathIndex[key]);
            }
        };
    } else {
        var paths = permutePath(path) || [path];
        pathMatcher = function matchRFC(domainIndex) {
            paths.forEach(function(curPath) {
                var pathIndex = domainIndex[curPath];
                if (!pathIndex) {
                    return;
                }
                for (var key in pathIndex) {
                    results.push(pathIndex[key]);
                }
            });
        };
    }
    var domains = permuteDomain(domain) || [domain];
    var idx = this.idx;
    domains.forEach(function(curDomain) {
        var domainIndex = idx[curDomain];
        if (!domainIndex) {
            return;
        }
        pathMatcher(domainIndex);
    });
    cb(null, results);
};
CookieMonster.prototype.putCookie = function(cookie, cb) {
    if (!this.idx[cookie.domain]) {
        this.idx[cookie.domain] = {};
    }
    if (!this.idx[cookie.domain][cookie.path]) {
        this.idx[cookie.domain][cookie.path] = {};
    }
    this.idx[cookie.domain][cookie.path][cookie.key] = cookie;
    this.saveToRepository(this.id, this.idx, function() {
        cb(null);
    });
};
CookieMonster.prototype.updateCookie = function updateCookie(oldCookie, newCookie, cb) {
    // updateCookie() may avoid updating cookies that are identical.  For example,
    // lastAccessed may not be important to some stores and an equality
    // comparison could exclude that field.
    this.putCookie(newCookie, cb);
};
CookieMonster.prototype.removeCookie = function removeCookie(domain, path, key, cb) {
    if (this.idx[domain] && this.idx[domain][path] && this.idx[domain][path][key]) {
        delete this.idx[domain][path][key];
    }
    this.saveToRepository(this.id, this.idx, function() {
        cb(null);
    });
};
CookieMonster.prototype.removeCookies = function removeCookies(domain, path, cb) {
    if (this.idx[domain]) {
        if (path) {
            delete this.idx[domain][path];
        } else {
            delete this.idx[domain];
        }
    }
    this.saveToRepository(this.id, this.idx, function() {
        return cb(null);
    });
};
CookieMonster.prototype.saveToRepository = function saveToRepository(id, data, cb) {
    var dataJson = JSON.stringify(data);
    this.repository.set(id, dataJson);
    cb();
};
CookieMonster.prototype.loadFromRepository = function loadFromFile(id, cb) {
    this.repository.get(id, function(err, data) {
        if (err) throw (err);
        var dataJson = data ? JSON.parse(data) : null;
        for (var domainName in dataJson) {
            for (var pathName in dataJson[domainName]) {
                for (var cookieName in dataJson[domainName][pathName]) {
                    dataJson[domainName][pathName][cookieName] = tough.fromJSON(JSON.stringify(dataJson[domainName][pathName][cookieName]));
                }
            }
        }
        cb(dataJson);
    });
};