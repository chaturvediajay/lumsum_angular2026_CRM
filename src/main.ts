/// <reference types="@angular/localize" />

import { bootstrapApplication } from "@angular/platform-browser";
import { appConfig } from "./app/app.config";
import { App } from "./app/app";
import { environment } from "@environments/environment";
import { enableProdMode } from "@angular/core";

if (environment.production) {
  enableProdMode();
  if (window) {
    // window.console.log = function () {};
    // window.console.error = function () {};
    // window.console.warn = function () {};
    // window.console.info = function () {};
    // window.console.debug = function () {};
    // window.console.trace = function () {};
    // window.console.group = function () {};
    // window.console.groupEnd = function () {};
    // window.console.time = function () {};
    // window.console.timeEnd = function () {};
    // window.console.assert = function () {};
  }
} else {
  // console.log("Running in development mode");
  if (window) {
    // window.console.log = function () {};
    // window.console.error = function () {};
    // window.console.warn = function () {};
  }
}

bootstrapApplication(App, appConfig)
  .then(() => {
    // Select all elements containing the attribute and remove it
    const appRoots = document.querySelectorAll("[ng-version]");
    appRoots.forEach((el) => {
      el.removeAttribute("ng-version");
    });
  })
  .catch((err) => console.error(err));
