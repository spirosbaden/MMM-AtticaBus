Module.register("MMM-AtticaBus", {
    defaults: {
        updateInterval: 30000, // 30 δευτερόλεπτα
        stations: []
    },

    start: function() {
        this.busData = "Φόρτωση τηλεματικής...";
        this.sendSocketNotification("GET_BUS_DATA", this.config.stations);
        this.scheduleUpdate();
    },

    scheduleUpdate: function() {
        var self = this;
        setInterval(function() {
            self.sendSocketNotification("GET_BUS_DATA", self.config.stations);
        }, this.config.updateInterval);
    },

    socketNotificationReceived: function(notification, payload) {
        if (notification === "BUS_DATA_RESULT") {
            this.busData = payload;
            this.updateDom();
        }
    },

    getDom: function() {
        var wrapper = document.createElement("div");
        wrapper.className = "dimmed light small";
        wrapper.style.textAlign = "left";
        wrapper.innerHTML = this.busData;
        return wrapper;
    }
});