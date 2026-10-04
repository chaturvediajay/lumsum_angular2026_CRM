import { HttpClient } from "@angular/common/http";
import { Injectable } from "@angular/core";

@Injectable({
  providedIn: "root",
})
export class Config {
  private appConfig: any;
  constructor(private _http:HttpClient) {}

  loadConfig() {
    return fetch("/assets/config.json")
      .then((response) => response.json())
      .then((config) => {
        this.appConfig = config;
      })
      .catch((error) => {
        console.error("Error loading config:", error);
      });
  }

  get apiUrl(): string {
    return this.appConfig?.apiUrl || "";
  }

  get featureFlag(): boolean {
    return this.appConfig?.featureFlag || false;
  }
}
