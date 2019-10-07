const request = require('request');
var Service, Characteristic, Accessory, AccessoryType, UUIDGen;

var validateResponse = function(error, response, body, requestLabel) {
    // Check for errorss in response.
    if (error) {
        this.log("Error sending " + requestLabel + " request to hub. '" + error + "'");
        return false;
    }
    if (!('success' in body)) {
        this.log("Hub gave invalid response to " + requestLabel + " request.");
        return false;
    }
    if (!body.success) {
        var errormsg = "Hub failed on " + requestLabel + " request.";
        if (msg in body) {
            errormsg += " Reason: '" + body.msg  + "'";
        }
        this.log(errormsg);
        return false;
    }
    if (!('data' in body)) {
        this.log("Hub missing data in response to " + requestLabel + " request.");
        return false;
    }

    // Valid response.
    return true;
};

function HarborBreezePlatform(log, config, api) {
    this.log = log;
    this.config = config;
    this.api = api;
    this.accessories = [];

    log("HarborBreezePlatform Init");

    Service = this.api.hap.uuid;
    Characteristic = this.api.hap.Characteristic;
    Accessory = this.api.platformAccessory;
    AccessoryType = this.api.hap.Accessory.Categories;
    UUIDGen = this.api.hap.uuid;

    this.api.on('didFinishLaunching', function() {
        this.log("DidFinishLaunching - hbb");
        this.initPlatform();
    }.bind(this));
}

module.exports = HarborBreezePlatform;

HarborBreezePlatform.prototype.initPlatform = function() {
    var req_url = this.config.hub_address + '/api/fans?access_code=' + this.config.access_code;
    request(req_url, { json: true }, function(error, response, body) {
        // Check for invalid response.
        if (!validateResponse(error, response, body, "GET fans")) {
            return;
        }

        // Response is valid.
        for (var i = 0; i < body.data.length; i++) {
            this.addFan(body.data[i]);
        }
    }.bind(this));
};

HarborBreezePlatform.prototype.addFan = function(fan) {
    // Check fan object
    if (fan.remote_id == null || fan.has_light == null || fan.dimmable == null || fan.max_dim_steps == null
                                                    || fan.has_breeze == null || fan.has_rotation == null) {
        return;
    }
    this.log("Adding Fan Accessory - (remote id: '" + fan.remote_id + "', has light: '" + fan.has_light
            + "', is dimmable: " + fan.dimmable + ", dimmable steps: " + fan.max_dim_steps 
            + ", has breeze mode: " + fan.has_breeze + ", has rotation control: " + fan.has_rotation + ")");
    
    var accessoryName = "HarborBreeze.Fan." + fan.remote_id;
    var uuid = UUIDGen.generate(accessoryName);

    var newAccessory = new Accessory(accessoryName, uuid);
    newAccessory.on('identify', function(paired, callback) {
        this.log(newAccessory.displayName, "Identify!!!");
        callback();
    }.bind(this));

    this.accessories.push(newAccessory);
    this.api.registerPlatformAccessories('homebridge-harbor-breeze-hub', 'HarborBreezePlatform', [newAccessory]);
};

// Set configuration
HarborBreezePlatform.prototype.configurationRequestHandler = function(ctx, req, cb) {
    this.log("config requet");
    this.log("Context: ", JSON.stringify(ctx));
    this.log("Request: ", JSON.stringify(req));
};

// Restore cached accessory
HarborBreezePlatform.prototype.configureAccessory = function(accessory) {
    var platformName = accessory.context.subPlatformName;
    this.log("platform name: " + platformName);
    this.log("accessory name: " + accessory.displayName);
};
