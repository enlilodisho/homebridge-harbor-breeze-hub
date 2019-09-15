const queryString = require('query-string');
const request = require('request');
const inherits = require('util').inherits;

var Accessory, Service, Characteristic, UUIDGen;

module.exports = function(homebridge) {
    Accessory = homebridge.platformAccessory;
    Service = homebridge.hap.Service;
    Characteristic = homebridge.hap.Characteristic;
    UUIDGen = homebridge.hap.uuid;

    homebridge.registerPlatform("homebridge-harbor-breeze-hub", "HarborBreezeHub", HarborBreezePlatform);
}

// Platform constructor.
// config may be null,
function HarborBreezePlatform(log, config) {
    log("HarborBreezePlatform Init");
    var platform = this;
    this.log = log;
    this.config = config;

    var acc = HarborBreezeFanAccessory.prototype;
    inherits(HarborBreezeFanAccessory, Accessory);
    HarborBreezeFanAccessory.prototype.parent = Accessory.prototype;
    for (var x in acc) {
        HarborBreezeFanAccessory.prototype[x] = acc[x];
    }

    // Load rom config.
    this.hubAddr = "http://" + config['hubAddress'];
}

// Send GET requet to hub.
// Returns (error, json).
HarborBreezePlatform.prototype.hubGetJson = function(path, callback) {
    var platform = this;

    // Format path correctly.
    path = path.toString();
    if (path[0] != '/') {
        path = '/' + path;
    }

    // Send get request.
    request({url:this.hubAddr+path+'?access_code='+this.config.accessCode,method:'GET'},
    (error, resp, body) => {
        if (error) {
            if (resp) {
                platform.log("Error sending GET request to hub (" + resp.statusCode + ").");
            } else {
                platform.log("Error sending GET request to hub.");
                platform.log(error);
            }
            callback(true, null);
            return;
        }
        try {
            var data = JSON.parse(body);
        } catch(e) {
            platform.log("Hub responded to GET request with non json data.");
            callback(true, null);
            return;
        }
        if (!('success' in data)) {
            platform.log("Hub sent invalid response to GET request.");
            callback(true, null);
            return;
        } else if (!data.success) {
            if ('msg' in data) {
                platform.log("Hub responded with error message to GET request: '" + data.msg + "'");
            } else {
                platform.log("Hub responded with error to GET request.");
            }
            callback(true, null);
            return;
        }
        if (!('result' in data)) {
            platform.log("Hub sent invalid response to GET request.");
            callback(true, null);
            return;
        } else {
            callback(false, data.result);
            return;
        }
    });
}

// Send PUT request to hub.
// Returns (error).
HarborBreezePlatform.prototype.hubPutJson = function(path, jsondata, callback) {
    var platform = this;

    // Format path correctly.
    path = path.toString();
    if (path[0] != '/') {
        path = '/' + path;
    }

    jsondata['access_code'] = this.config.accessCode;
    var query = queryString.stringify(jsondata);
    // Send put request.
    request({uri:this.hubAddr+path+'?'+query, method:'PUT', json: true},
    (error, resp, body) => {
        if (error) {
            if (resp) {
                platform.log("Error sending PUT request to hub (" + resp.statusCode + ").");
            } else {
                platform.log("Error sending PUT request to hub.");
                platform.log(error);
            }
            callback(true);
            return;
        }
        var data = body;
        if (!('success' in data)) {
            platform.log("Hub sent invalid response to PUT request.");
            callback(true);
            return;
        } else if (!data.success) {
            if ('msg' in data) {
                platform.log("Hub responded with error message to PUT request: '" + data.msg + "'");
            } else {
                platform.log("Hub responded with error to PUT request.");
            }
            callback(true);
            return;
        }
        callback(false);
    });
}

// Get list of all fans.
HarborBreezePlatform.prototype.accessories = function(callback) {
    var platform = this;
    this.log("Fetching Harbor Breeze fan.");
    this.hubGetJson('/api/fans', (error, data) => {
        if (error) {
            callback([]);
            return;
        }
        var foundAccessories = [];
        for (var i = 0; i < data.length; i++) {
            var accessory = new HarborBreezeFanAccessory(data[i].remote_id, platform);
            foundAccessories.push(accessory);
        }
        callback(foundAccessories);
    });
}

function HarborBreezeFanAccessory(remoteId, platform) {
    this.platform = platform;
    this.log = platform.log;

    this.name = "HarborBreeze" + remoteId;
    this.remoteId = remoteId;

    this.uuid_base = UUIDGen.generate("harborbreeze."+remoteId);
    Accessory.call(this, this.name, this.uuid_base);

    this.getService(Service.AccessoryInformation)
        .setCharacteristic(Characteristic.Manufacturer, "Harbor Breeze")
        .setCharacteristic(Characteristic.Model, "Ceiling Fan");

    var lightName = this.name + "-Light";
    var fanName = this.name + "-Fan";

    this.addService(Service.Lightbulb, lightName);
    this.getService(Service.Lightbulb)
        .getCharacteristic(Characteristic.On)
        .on('get', this.getLightPower.bind(this))
        .on('set', this.setLightOn.bind(this));
}

HarborBreezeFanAccessory.prototype.getServices = function() {
    return this.services;
};

HarborBreezeFanAccessory.prototype.setLightOn = function(on, callback) {
    this.log("Setting " + this.name + " light to " + on);
    this.platform.hubPutJson('/api/fans/'+this.remoteId+'/light', {value:(on)?'on':'off'},
        (error) => {
            if (error) {
                callback(error);
            } else {
                callback();
            }
        }
    );
};

HarborBreezeFanAccessory.prototype.getLightPower = function(callback) {
    this.platform.hubGetJson('/api/fans/'+this.remoteId+'/light', (error, result) => {
        if (!error && 'light' in result) {
            callback(null, (result['light'] == 'on') ? true : false);
        }
    });
};

// Register accessory in homebridge.
HarborBreezePlatform.prototype.addAccessory = function(accessoryName) {
    this.log("Add Accessory");
    var platform = this;
    var uuid;

    uuid = UUIDGen.generate(accessoryName);

    var newAccessory = new Accessory(accessoryName, uuid);
    newAccessory.on('identify', function(paired, callback) {
        platform.log(newAccessory.displayName, "Identify!!!");
        callback();
    });

    newAccessory.addService(Service.Fan, "Fan")
        .getCharacteristic(Characteristic.On)
        .on('set', function(value, callback) {
            platform.log(newAccessory.displayName, "Fan -> " + value);
            callback();
        });

    this.accessories.push(newAccessory);
    this.api.registerPlatformAccessories("homebridge-harbor-breeze-hub", "HarborBreezeHub", [newAccessory]);
}

// Unregister all registered accessories.
HarborBreezePlatform.prototype.removeAllAccessories = function() {
    this.log("Remove all Accessories");
    this.api.unregisterPlatformAccessories("homebridge-harbor-breeze-hub", "HarborBreezeHub", this.accessories);

    this.accessories = [];
}
