(() => {
  'use strict';
  if (!window.desktopAPI) return;
  const api = window.desktopAPI;
  const button = document.createElement('button'); button.className = 'desktop-settings-button'; button.textContent = '单词提醒'; button.type = 'button';
  document.querySelector('.topbar-right').prepend(button);
  const dialog = document.createElement('dialog'); dialog.className='help-dialog reminder-settings'; dialog.id='reminder-settings';
  dialog.innerHTML = '<form><div class="dialog-top"><h2>桌面单词提醒</h2><button type="button" class="icon-button" id="reminder-settings-close" aria-label="关闭提醒设置">×</button></div><div class="help-content"><label class="setting-row"><span>启用定时提醒</span><input id="reminder-enabled" type="checkbox"></label><label class="setting-row"><span>提醒间隔（分钟）</span><input id="reminder-interval" type="number" min="1" max="1440" required></label><label class="setting-row"><span>登录 Windows 时启动</span><input id="reminder-login" type="checkbox"></label><p>提醒先显示单词，点击后才展开解释。卡片会一直保留到你手动关闭，期间不会弹出新的卡片；关闭后重新计时。</p><p>关闭主窗口后，软件仍会在右下角托盘运行。要停止运行，请右键托盘图标选择「退出软件」。学习记录只保存在本机。</p><div class="reminder-setting-actions"><button type="button" id="reminder-now" class="outline-button">立即试一张</button><button type="submit" class="review-button">保存设置</button></div><p id="reminder-settings-status" role="status"></p></div></form>';
  document.body.append(dialog);
  const $ = id => document.getElementById(id);
  const showSettings = value => { $('reminder-enabled').checked=value.enabled; $('reminder-interval').value=value.intervalMinutes; $('reminder-login').checked=value.launchAtLogin; };
  button.addEventListener('click', async () => { try { showSettings(await api.getSettings()); $('reminder-settings-status').textContent=''; dialog.showModal(); } catch { button.textContent='设置读取失败，请重试'; } });
  $('reminder-settings-close').onclick = () => dialog.close();
  $('reminder-now').onclick = async () => { await api.showReminder(); $('reminder-settings-status').textContent='提醒已显示在桌面右下角。'; };
  dialog.querySelector('form').onsubmit = async event => { event.preventDefault(); try { showSettings(await api.saveSettings({enabled:$('reminder-enabled').checked,intervalMinutes:Number($('reminder-interval').value),launchAtLogin:$('reminder-login').checked})); $('reminder-settings-status').textContent='设置已保存。'; } catch { $('reminder-settings-status').textContent='保存失败，请重试。'; } };
  api.onSettings(showSettings);
})();
