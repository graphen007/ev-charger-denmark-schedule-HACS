"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Notifier = void 0;
const settings_js_1 = require("./settings.js");
class Notifier {
    constructor(ha) {
        this.ha = ha;
    }
    async pricesPublished(tomorrowAvgEp, cheapestWindowLabel) {
        const { notifications } = (0, settings_js_1.loadSettings)();
        if (!notifications.price_published)
            return;
        await this.ha.sendNotification("⚡ Tomorrow's electricity prices published", `Cheapest window: ${cheapestWindowLabel}\nAverage: ~${tomorrowAvgEp.toFixed(2)} DKK/kWh`);
    }
    async chargeComplete(carName, finalSoc, kwhAdded, cost) {
        const { notifications } = (0, settings_js_1.loadSettings)();
        if (!notifications.charge_complete)
            return;
        await this.ha.sendNotification(`🔋 ${carName} fully charged`, `${Math.round(finalSoc)}% SoC — +${kwhAdded.toFixed(1)} kWh — ~${cost.toFixed(2)} DKK`);
    }
    async priceSpike(windowLabel, maxEp) {
        const { notifications } = (0, settings_js_1.loadSettings)();
        if (maxEp < notifications.price_spike_threshold)
            return;
        await this.ha.sendNotification("⚠️ Electricity price spike tomorrow", `Peak at ${windowLabel}: ${maxEp.toFixed(2)} DKK/kWh`);
    }
}
exports.Notifier = Notifier;
