'use strict';
const {contextBridge, ipcRenderer} = require('electron');
contextBridge.exposeInMainWorld('desktopAPI', Object.freeze({
  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveSettings: settings => ipcRenderer.invoke('settings:save', settings),
  showReminder: () => ipcRenderer.invoke('reminder:show'),
  closeReminder: () => ipcRenderer.send('reminder:close'),
  expandReminder: expanded => ipcRenderer.send('reminder:expand', expanded === true),
  openWord: id => ipcRenderer.send('word:open', id),
  onOpenWord: callback => { const listener = (_event, id) => callback(id); ipcRenderer.on('word:open', listener); return () => ipcRenderer.removeListener('word:open', listener); },
  onSettings: callback => { const listener = (_event, value) => callback(value); ipcRenderer.on('settings:changed', listener); return () => ipcRenderer.removeListener('settings:changed', listener); }
}));
