/* global require */

const { contextBridge } = require("electron");
const { ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("posElectron", {
  isElectron: true,
  getPrinters: () => ipcRenderer.invoke("pos:get-printers"),
  printTicket: (ticketUrlOrSaleId, options) =>
    ipcRenderer.invoke("pos:print-ticket", ticketUrlOrSaleId, options)
});

contextBridge.exposeInMainWorld("posDesktop", {
  platform: "electron",
  isElectron: true
});
