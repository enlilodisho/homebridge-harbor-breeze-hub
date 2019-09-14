const request = require('request');

var Accessory, Service, Characteristic, UUIDGen;

module.exports = function(homebridge) {
    Accessory = homebridge.platformAccessory;

    Service = homebridge.hap.Service;
    Characteristic = homebridge.hap.Characteristic;
    UUIDGen = homebridge.hap.uuid;

    homebridge.registerPlatform("homebridge-harbor-breeze-hub", "HarborBreezeHub", true);
}

// Platform constructor.
// config may be null,
// api may be null if using old homebridge version
function HarborBreezeHub(log, config, api) {
    log("HarborBreezeHub Init");
    var platform = this;
    this.log = log;
    this.config = config;
    this.accessories = [];

    // Get hub network address from config.
    this.hubAddr = config['netAddr'];

    if (api) {
        this.api = api;

        this.api.on('didFinishLaunching', function() {
            platform.log("DidFinishLaunching");
            this.getAvailableFans();
        }.bind(this));
    }
}

// Get list of all fans from hub.
HarborBreezeHub.prototype.getAvailableFans = function(callback) {
    var platform = this;
    request({url:hubAddr,method:'GET'}, (error, resp, body) => {
        if (error) {
            platform.log("Error connecting to hub (" + resp.statusCode + ").");
            callback([]);
            return;
        }
        fans = JSON.parse(body);
        for (fan in fans) {
            platform.log("Found fan: '" + fan.name);
        }
    });
}

// Register accessory in homebridge.
HarborBreezeHub.prototype.addAccessory = function(accessoryName) {
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
HarborBreezeHub.prototype.removeAllAccessories = function() {
    this.log("Remove all Accessories");
    this.api.unregisterPlatformAccessories("homebridge-harbor-breeze-hub", "HarborBreezeHub", this.accessories);

    this.accessories = [];
}
