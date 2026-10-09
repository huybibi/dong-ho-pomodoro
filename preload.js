'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('tomato', {
  getState: () => ipcRenderer.invoke('state:get'),
  action: (name, payload) => ipcRenderer.invoke('action', name, payload),
  onState: (cb) => ipcRenderer.on('state', (_e, s) => cb(s)),
  onEvent: (cb) => ipcRenderer.on('event', (_e, s) => cb(s)),
  onNav: (cb) => ipcRenderer.on('nav', (_e, s) => cb(s)),
  win: {
    close: (name) => ipcRenderer.send('win:close', name),
    hide: (name) => ipcRenderer.send('win:hide', name),
    show: (name) => ipcRenderer.send('win:show', name),
    setSize: (w, h) => ipcRenderer.send('win:size', w, h),
    setClickThrough: (flag) => ipcRenderer.send('win:clickThrough', flag),
    quit: () => ipcRenderer.send('app:quit'),
  },
  drag: {
    start: () => ipcRenderer.send('drag:start'),
    move: (x, y) => ipcRenderer.send('drag:move', x, y),
    end: () => ipcRenderer.send('drag:end'),
  },
});
