import { HttpClient, HttpHeaders } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { environment } from "@environments/environment";
import { catchError, Observable, timeout, throwError } from "rxjs";
import { EMPTY } from "rxjs";

@Injectable({
  providedIn: "root",
})
export class CommonHttp {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  /**
   * Dynamically constructs fresh headers with the current token from sessionStorage
   */
  private getHeaders(): HttpHeaders {
    let headers = new HttpHeaders({
      "Cache-Control": "no-cache",
      Pragma: "no-cache",
    });

    const token = sessionStorage.getItem("access_token");
    if (token && token.trim() !== "" && token !== "null") {
      headers = headers.set("Authorization", `Bearer ${token.trim()}`);
    } else {
      console.warn("CommonHttp: no active access token found in sessionStorage");
    }

    return headers;
  }

  /**
   * Generic GET request to backend API
   */
  getAll<T = any>(domainName: string | null, url: string): Observable<T[]> {
    if (!url || url.trim() === "") {
      throw new Error("Invalid URL passed to CommonHttp.getAll");
    }

    const baseUrl = this.apiUrl.replace(/\/+$/, "");
    const path = url.startsWith("/") ? url : `/${url}`;
    const requestUrl = `${baseUrl}${path}`;

    return this.http.get<T[]>(requestUrl, { headers: this.getHeaders() }).pipe(
      timeout(10000),
      catchError((err) => {
        if (err.name === "TimeoutError") {
          console.error("Request timed out after 10 seconds:", requestUrl);
        } else {
          console.error("HTTP Error:", err);
        }
        return throwError(() => err);
      })
    );
  }

  /**
   * Calls the backend signout endpoint to blacklist the current JWT token
   * Endpoint: POST /api/auth/signout
   */
  logout(): Observable<any> {
    const logoutUrl = `${this.apiUrl.replace(/\/+$/, "")}/auth/signout`;
    const headers = this.getHeaders();

    return this.http
      .post<any>(logoutUrl, {}, { headers })
      .pipe(
        timeout(5000),
        catchError((err) => {
          console.warn("Signout request failed or timed out:", err);
          return EMPTY;
        })
      );
  }
}
