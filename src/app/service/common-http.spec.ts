import { HttpClientTestingModule, HttpTestingController } from "@angular/common/http/testing";
import { TestBed } from "@angular/core/testing";
import { environment } from "@environments/environment";

import { CommonHttp } from "./common-http";

describe("CommonHttp", () => {
  let service: CommonHttp;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
    });
    service = TestBed.inject(CommonHttp);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it("should be created", () => {
    expect(service).toBeTruthy();
  });

  it("should send a logout request with headers", () => {
    service.logout().subscribe();

    const req = httpMock.expectOne(`${environment.apiUrl}/auth/signout`);
    expect(req.request.method).toBe("POST");
    expect(req.request.headers.get("Cache-Control")).toBe("no-cache");
    req.flush([]);
  });
});
