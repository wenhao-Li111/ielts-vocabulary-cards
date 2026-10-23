const {test} = require('node:test');
const assert = require('node:assert/strict');
const {ReminderClock, cleanSettings} = require('../desktop/reminder-clock.cjs');
test('default is 30 minutes; one visible reminder blocks later reminders without replacing it', () => {
  const clock = new ReminderClock(undefined,0);
  assert.equal(clock.tick(1799999,false),false);
  assert.equal(clock.tick(1800000,false),true);
  assert.equal(clock.tick(3600000,true),false);
  assert.equal(clock.tick(86400000,true),false);
  clock.dismissed(86400000);
  assert.equal(clock.tick(86400001,false),false);
  assert.equal(clock.tick(88200000,false),true);
});
test('pause, resume, changed intervals, and wake-up do not build a notification backlog', () => {
  const clock=new ReminderClock({enabled:false},0);
  assert.equal(clock.tick(999999999,false),false);
  clock.configure({enabled:true,intervalMinutes:15},1000000);
  assert.equal(clock.tick(1899999,false),false);
  assert.equal(clock.tick(10000000,false),true);
  assert.equal(clock.tick(10000001,false),false);
});
test('invalid IPC settings cannot create zero-delay or infinite timers', () => {
  assert.equal(cleanSettings(null).intervalMinutes,30);
  for (const bad of [-5,0,NaN,Infinity,'bad',1441,1.5]) assert.equal(cleanSettings({intervalMinutes:bad}).intervalMinutes,30);
  assert.deepEqual(cleanSettings({enabled:'yes',launchAtLogin:'true'}),{enabled:true,intervalMinutes:30,launchAtLogin:false});
});
