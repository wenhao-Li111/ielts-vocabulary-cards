'use strict';
const DEFAULTS = Object.freeze({enabled:true, intervalMinutes:30, launchAtLogin:false});
function cleanSettings(input = {}) {
  if (!input || typeof input !== 'object') input = {};
  const interval = Number(input.intervalMinutes);
  return {
    enabled: typeof input.enabled === 'boolean' ? input.enabled : DEFAULTS.enabled,
    intervalMinutes: Number.isInteger(interval) && interval >= 1 && interval <= 1440 ? interval : 30,
    launchAtLogin: typeof input.launchAtLogin === 'boolean' ? input.launchAtLogin : false
  };
}
class ReminderClock {
  constructor(settings = DEFAULTS, now = Date.now()) { this.configure(settings, now); }
  configure(settings, now) { this.settings = cleanSettings(settings); this.nextAt = now + this.settings.intervalMinutes * 60000; }
  tick(now, visible) {
    if (!this.settings.enabled || visible || now < this.nextAt) return false;
    this.nextAt = now + this.settings.intervalMinutes * 60000;
    return true;
  }
  dismissed(now) { this.nextAt = now + this.settings.intervalMinutes * 60000; }
}
module.exports = {DEFAULTS, cleanSettings, ReminderClock};
