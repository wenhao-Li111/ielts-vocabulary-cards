'use strict';
const {app, BrowserWindow, Menu, Tray, ipcMain, protocol, net, screen, session, powerMonitor, dialog, shell} = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const {randomInt} = require('node:crypto');
const {cleanSettings, ReminderClock} = require('./reminder-clock.cjs');
const TITLE = '《雅思词汇真经》· Liu Hongbo 单词卡';
const ROOT = path.join(__dirname, '..');
const ORIGIN = 'ielts://app';
const smokeTest = !app.isPackaged && process.argv.includes('--smoke-test');
app.setName('IELTSVocabularyCards');
app.setPath('userData', smokeTest ? fs.mkdtempSync(path.join(app.getPath('temp'), 'ielts-cards-test-')) : !app.isPackaged && process.env.IELTS_TEST_PROFILE ? path.resolve(process.env.IELTS_TEST_PROFILE) : path.join(app.getPath('appData'), 'IELTSVocabularyCards'));
app.setAppUserModelId('com.wenhaoli.ieltscards');
protocol.registerSchemesAsPrivileged([{scheme:'ielts', privileges:{standard:true, secure:true, supportFetchAPI:true}}]);
const locked = app.requestSingleInstanceLock();
if (!locked) app.quit();
let mainWindow, reminderWindow, tray, quitting = false, pendingWord = null, previousId = null, timer;
let settings = cleanSettings(), clock;
const settingsPath = path.join(app.getPath('userData'), 'reminder-settings.json');
const book = JSON.parse(fs.readFileSync(path.join(ROOT, 'dist/book-data.js'), 'utf8').replace(/^window\.BOOK_DATA\s*=\s*/, '').replace(/;\s*$/, ''));
const ids = new Set(book.entries.map(e => e.id));
const prefs = {preload:path.join(__dirname, 'preload.cjs'), contextIsolation:true, nodeIntegration:false, sandbox:true, webSecurity:true};
const externalAllowed = url => /^https:\/\/(github\.com\/wenhao-Li111\/ielts-vocabulary-cards(?:\/|$)|wenhao-li111\.github\.io\/ielts-vocabulary-cards(?:\/|$))/i.test(url);
function secureWindow(win) {
  win.webContents.setWindowOpenHandler(({url}) => { if (externalAllowed(url)) shell.openExternal(url); return {action:'deny'}; });
  win.webContents.on('will-navigate', (event, url) => { if (!url.startsWith(ORIGIN + '/')) { event.preventDefault(); if (externalAllowed(url)) shell.openExternal(url); } });
  win.webContents.on('will-attach-webview', event => event.preventDefault());
}
function validMain(event) { return mainWindow && event.sender === mainWindow.webContents && event.senderFrame?.url.startsWith(ORIGIN + '/index.html'); }
function validReminder(event) { return reminderWindow && event.sender === reminderWindow.webContents && event.senderFrame?.url.startsWith(ORIGIN + '/reminder.html'); }
function showMain(id) {
  if (!mainWindow || mainWindow.isDestroyed()) createMain();
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show(); mainWindow.focus();
  if (ids.has(id)) {
    if (mainWindow.webContents.isLoading()) pendingWord = id;
    else mainWindow.webContents.send('word:open', id);
  }
}
function createMain() {
  mainWindow = new BrowserWindow({width:1360,height:900,minWidth:375,minHeight:600,title:TITLE,icon:path.join(__dirname,'icons/app.ico'),show:false,backgroundColor:'#f8f8f5',webPreferences:prefs});
  secureWindow(mainWindow);
  mainWindow.setMenuBarVisibility(false);
  mainWindow.loadURL(ORIGIN + '/index.html');
  mainWindow.once('ready-to-show', () => { if (!process.argv.includes('--background')) mainWindow.show(); });
  mainWindow.webContents.on('did-finish-load', () => { if (pendingWord) { mainWindow.webContents.send('word:open', pendingWord); pendingWord = null; } });
  mainWindow.on('close', event => { if (!quitting) { event.preventDefault(); mainWindow.hide(); } });
}
function reminderBounds(expanded = false) {
  const bounds = mainWindow?.getBounds();
  const display = bounds ? screen.getDisplayMatching(bounds) : screen.getPrimaryDisplay();
  const area = display.workArea;
  const width = Math.min(420, area.width - 24), height = Math.min(expanded ? 650 : 230, area.height - 32);
  return {width,height,x:area.x + area.width - width - 16,y:area.y + area.height - height - 16};
}
function showReminder() {
  if (reminderWindow && !reminderWindow.isDestroyed()) { reminderWindow.showInactive(); return; }
  const pool = book.entries.filter(e => e.id !== previousId);
  const entry = pool[randomInt(pool.length)]; previousId = entry.id;
  reminderWindow = new BrowserWindow({...reminderBounds(),title:entry.word,frame:false,resizable:false,minimizable:false,maximizable:false,alwaysOnTop:true,skipTaskbar:true,show:false,backgroundColor:'#fffdf8',webPreferences:prefs});
  secureWindow(reminderWindow);
  reminderWindow.loadURL(ORIGIN + '/reminder.html?word=' + entry.id);
  reminderWindow.once('ready-to-show', () => reminderWindow?.showInactive());
  reminderWindow.on('closed', () => { reminderWindow = null; clock.dismissed(Date.now()); });
}
function saveSettings(next) {
  const clean = cleanSettings(next);
  if (app.isPackaged && clean.launchAtLogin !== settings.launchAtLogin) {
    app.setLoginItemSettings({openAtLogin:clean.launchAtLogin,path:process.execPath,args:['--background']});
  }
  fs.mkdirSync(path.dirname(settingsPath), {recursive:true});
  fs.writeFileSync(settingsPath + '.tmp', JSON.stringify(clean, null, 2));
  fs.renameSync(settingsPath + '.tmp', settingsPath);
  settings = clean; clock.configure(settings, Date.now()); updateTray();
  mainWindow?.webContents.send('settings:changed', settings);
  return settings;
}
function updateTray() {
  if (!tray) return;
  tray.setToolTip(TITLE + (settings.enabled ? ` · 每 ${settings.intervalMinutes} 分钟提醒` : ' · 提醒已暂停'));
  tray.setContextMenu(Menu.buildFromTemplate([
    {label:'打开单词卡',click:() => showMain()},
    {label:'现在提醒一个单词',click:showReminder},
    {label:settings.enabled ? '暂停提醒' : '继续提醒',click:() => saveSettings({...settings,enabled:!settings.enabled})},
    {label:'提醒间隔',submenu:[15,30,60,120].map(n => ({label:`每 ${n} 分钟`,type:'radio',checked:settings.intervalMinutes===n,click:() => saveSettings({...settings,intervalMinutes:n})}))},
    {type:'separator'}, {label:'退出软件（停止提醒）',click:() => { quitting = true; app.quit(); }}
  ]));
}
app.on('second-instance', () => showMain());
app.on('before-quit', () => { quitting = true; clearInterval(timer); });
app.on('window-all-closed', () => {});
if (locked) app.whenReady().then(async () => {
  try { settings = cleanSettings(JSON.parse(fs.readFileSync(settingsPath,'utf8'))); } catch {}
  clock = new ReminderClock(settings);
  protocol.handle('ielts', request => {
    const url = new URL(request.url);
    if (url.host !== 'app') return new Response('Not found', {status:404});
    let file;
    const pathname = decodeURIComponent(url.pathname);
    const nativeFiles = new Set(['/reminder.html','/reminder.js','/reminder.css']);
    const base = path.join(ROOT, nativeFiles.has(pathname) ? 'desktop' : 'dist');
    file = path.resolve(base, '.' + (pathname === '/' ? '/index.html' : pathname));
    if (!file.startsWith(base + path.sep)) return new Response('Not found', {status:404});
    return net.fetch(pathToFileURL(file).href);
  });
  session.defaultSession.setPermissionRequestHandler((_web, _permission, callback) => callback(false));
  session.defaultSession.on('will-download', (_event, item) => {
    item.setSaveDialogOptions({title:'导出学习进度',defaultPath:path.join(app.getPath('downloads'),item.getFilename())});
  });
  ipcMain.handle('settings:get', event => { if (!validMain(event)) throw new Error('Unsupported sender'); return settings; });
  ipcMain.handle('settings:save', (event, next) => { if (!validMain(event)) throw new Error('Unsupported sender'); return saveSettings(next); });
  ipcMain.handle('reminder:show', event => { if (!validMain(event)) throw new Error('Unsupported sender'); showReminder(); });
  ipcMain.on('reminder:close', event => { if (validReminder(event)) reminderWindow.close(); });
  ipcMain.on('reminder:expand', (event, expanded) => { if (validReminder(event)) reminderWindow.setBounds(reminderBounds(expanded === true)); });
  ipcMain.on('word:open', (event, id) => { if (validReminder(event) && ids.has(id)) showMain(id); });
  createMain();
  tray = new Tray(path.join(__dirname,'icons/tray.png'));
  tray.on('double-click', () => showMain()); updateTray();
  timer = setInterval(() => { if (clock.tick(Date.now(), !!reminderWindow)) showReminder(); }, 1000);
  powerMonitor.on('resume', () => { if (clock.tick(Date.now(), !!reminderWindow)) showReminder(); });
  if (process.argv.includes('--reminder')) showReminder();
  if (smokeTest) {
    await require('../tests/desktop-smoke.cjs')({app,mainWindow,getReminder:()=>reminderWindow,clock,showMain,settingsPath,root:ROOT});
    quitting=true; app.quit();
  }
}).catch(error => {
  if (smokeTest) {
    fs.mkdirSync(path.join(ROOT,'tmp'),{recursive:true});
    fs.writeFileSync(path.join(ROOT,'tmp/desktop-smoke-result.json'),JSON.stringify({passed:false,error:error.stack},null,2));
    quitting=true; app.exit(1);
  } else { dialog.showErrorBox(TITLE, '启动失败：' + error.message); quitting=true; app.quit(); }
});
