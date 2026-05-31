import type { HaClient } from "./haClient.js";
import { loadSettings } from "./settings.js";

export class Notifier {
  constructor(private ha: HaClient) {}

  async pricesPublished(tomorrowAvgEp: number, cheapestWindowLabel: string): Promise<void> {
    const { notifications } = loadSettings();
    if (!notifications.price_published) return;
    await this.ha.sendNotification(
      "⚡ Tomorrow's electricity prices published",
      `Cheapest window: ${cheapestWindowLabel}\nAverage: ~${tomorrowAvgEp.toFixed(2)} DKK/kWh`,
    );
  }

  async chargeComplete(carName: string, finalSoc: number, kwhAdded: number, cost: number): Promise<void> {
    const { notifications } = loadSettings();
    if (!notifications.charge_complete) return;
    await this.ha.sendNotification(
      `🔋 ${carName} fully charged`,
      `${Math.round(finalSoc)}% SoC — +${kwhAdded.toFixed(1)} kWh — ~${cost.toFixed(2)} DKK`,
    );
  }

  async priceSpike(windowLabel: string, maxEp: number): Promise<void> {
    const { notifications } = loadSettings();
    if (maxEp < notifications.price_spike_threshold) return;
    await this.ha.sendNotification(
      "⚠️ Electricity price spike tomorrow",
      `Peak at ${windowLabel}: ${maxEp.toFixed(2)} DKK/kWh`,
    );
  }
}
