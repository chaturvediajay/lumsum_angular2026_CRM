import { ChangeDetectorRef, Component, OnInit } from "@angular/core";
import {
  FormBuilder,
  FormGroup,
  Validators,
  ReactiveFormsModule,
} from "@angular/forms";
import { CommonModule } from "@angular/common";
import { HttpClient } from "@angular/common/http";
import { firstValueFrom } from "rxjs";
import { NgbModal, NgbModule } from "@ng-bootstrap/ng-bootstrap";
import { FormsModule } from "@angular/forms";
import { Router, ActivatedRoute } from "@angular/router";
import { timeout, catchError } from "rxjs/operators";
import { of } from "rxjs";
import { CommonHttp } from "../service/common-http";
import { UserService } from "../service/user-service";
import { SessionSyncService } from "../service/session-sync.service";

declare var bootstrap: any;

@Component({
  selector: "app-login",
  standalone: true,
  imports: [NgbModule, FormsModule, ReactiveFormsModule, CommonModule],
  templateUrl: "./login.html",
  styleUrl: "./login.scss",
})
export class Login implements OnInit {
  posts: any[] = [];

  isLoggedIn = false;
  username = "";
  password = "";
  isSubmitted = false;
  errorMessage = "";
  successMessage = "";
  showPassword = false;
  rememberMe = false;

  loginForm: FormGroup;

  isLoading = false;

  constructor(
    private modalService: NgbModal,
    private http: HttpClient,
    private formBuilder: FormBuilder,
    private router: Router,
    private route: ActivatedRoute,
    private commonHttp: CommonHttp,
    private userService: UserService,
    private sessionSync: SessionSyncService,
    private cdr: ChangeDetectorRef,
  ) {
    this.loginForm = this.formBuilder.group({
      email: [
        "",
        [
          Validators.required,
          Validators.pattern(/^\S*$/),
        ],
      ],
      password: [
        "",
        [
          Validators.required,
          Validators.minLength(6),
          Validators.pattern(/^\S*$/),
        ],
      ],
      rememberMe: [false],
    });
  }

  ngOnInit(): void {
    this.route.queryParams.subscribe((params) => {
      if (params["sessionExpired"] === "true") {
        this.errorMessage = "Your session has expired. Please log in again.";
      } else if (params["idleTimeout"] === "true") {
        this.errorMessage = "You have been automatically logged out due to 5 minutes of inactivity. Please log in again.";
      } else if (params["sessionTerminated"] === "true") {
        this.errorMessage = "Your session has been terminated. Please log in again.";
      } else if (params["connectionRefused"] === "true" || params["serverUnavailable"] === "true") {
        this.errorMessage =
          "Server is down: The backend application or service is stopped or crashed or Backend server connection refused";
      }
      this.cdr.detectChanges();
    });

    if (this.userService.isTokenValid()) {
      this.router.navigate(["/home"]);
      return;
    } else {
      this.userService.clearSession();
    }

    // Auto-strip spaces from email field as user types
    this.loginForm.get("email")?.valueChanges.subscribe((value: string) => {
      if (value && /\s/.test(value)) {
        this.loginForm.get("email")?.setValue(value.replace(/\s/g, ""), {
          emitEvent: false,
        });
      }
    });
  }

  // Getter for easy access to form controls
  get f() {
    return this.loginForm.controls;
  }

  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
    this.cdr.detectChanges();
  }

  getPasswordFieldType(): string {
    return this.showPassword ? "text" : "password";
  }

  getPasswordIconClass(): string {
    return this.showPassword ? "👁️" : "👁️‍🗨️";
  }

  open(content: any) {
    this.modalService.open(content, { ariaLabelledBy: "modal-basic-title" });
  }

  async onSubmit(): Promise<void> {
    this.isSubmitted = true;
    this.errorMessage = "";
    this.successMessage = "";

    if (this.loginForm.invalid) {
      return;
    }

    this.isLoading = true;
    this.cdr.detectChanges();
    try {
      const loginSuccess = await this.getLoginUser();
      if (loginSuccess) {
        this.successMessage = "Login successful! Redirecting...";
        this.cdr.detectChanges();
        console.log("Login process completed successfully");
      } else {
        this.errorMessage =
          "Login failed. Please check your credentials and try again.";
        console.log("Login process failed");
      }
    } catch (error: any) {
      if (error?.status === 0) {
        this.errorMessage =
          "Backend server connection refused (/api not working). Please ensure the backend server is running.";
      } else if (error?.status === 502 || error?.status === 503 || error?.status === 504) {
        this.errorMessage =
          "Backend service (/api) is currently unavailable. Please try again later.";
      } else {
        this.errorMessage =
          error?.error?.message || error?.message || "An error occurred. Please try again later.";
      }
      console.error("Login error:", error);
    } finally {
      this.isLoading = false;
      this.cdr.detectChanges();
    }
  }

  async getLoginUser(): Promise<boolean> {
    sessionStorage.clear();
    // Get form values
    this.username = this.loginForm.value.email;
    this.password = this.loginForm.value.password;
    const rememberMe = this.loginForm.value.rememberMe;

    try {
      // Wait for the signin response
      const response: any = await firstValueFrom(
        this.userService.userLogin(this.username, this.password),
      );

      console.debug("Login response:", response);
      const accessToken =
        response?.accessToken || response?.access_token || response?.token;
      const refreshToken =
        response?.refreshToken || response?.refresh_token;

      if (accessToken) {
        sessionStorage.setItem("access_token", accessToken);
        if (refreshToken) sessionStorage.setItem("refresh_token", refreshToken);
        if (response?.id) sessionStorage.setItem("user_id", String(response.id));
        if (response?.email) sessionStorage.setItem("email", response.email);
        if (response?.username) sessionStorage.setItem("username", response.username);
        if (response?.roles) sessionStorage.setItem("roles", JSON.stringify(response.roles));
        console.log("Login successful, token and profile stored");

        // Write a short-lived snapshot so new tabs can clone this session
        this.sessionSync.writeSnapshot(
          accessToken,
          refreshToken || "",
          response?.id ? String(response.id) : "",
          response?.username || "",
          response?.email || "",
          response?.roles ? JSON.stringify(response.roles) : "[]"
        );
        // Notify already-open tabs to sync this session
        this.sessionSync.broadcastLogin(
          accessToken,
          refreshToken || "",
          response?.id ? String(response.id) : "",
          response?.username || "",
          response?.email || "",
          response?.roles ? JSON.stringify(response.roles) : "[]"
        );
      } else {
        console.warn(
          "Login response did not include an access token",
          response,
        );
      }

      // Store remember me if checked
      if (rememberMe) {
        localStorage.setItem("savedUsername", this.username);
      } else {
        localStorage.removeItem("savedUsername");
      }

      this.isLoggedIn = true;
      console.log(
        "Login successful, navigating to home... " +
          JSON.stringify(this.userService.getDecodedToken()),
      );

      // Small delay to show success message
      setTimeout(() => {
        this.router.navigate(["/home"]);
      });

      this.loginForm.reset({
        email: "",
        password: "",
        rememberMe: false,
      });

      return true;
    } catch (error) {
      console.error("Login error:", error);
      throw error;
    }
  }

  ngAfterViewInit() {}

  fetchData1() {
    console.log("Fetching data...");
    this.isLoading = true;
    this.http
      .get("https://jsonplaceholder.typicode.com/posts", {
        observe: "response",
        headers: { "Cache-Control": "no-cache", Pragma: "no-cache" },
      })
      .pipe(
        timeout(10000), // ⏱ timeout after 10 seconds
        catchError((err) => {
          if (err.name === "TimeoutError") {
            console.error("Request timed out after 10 seconds");
          } else {
            console.error("HTTP Error:", err);
          }
          return of([]); // return empty array on error
        }),
      )
      .subscribe({
        next: (data: any) => {
          this.posts = [...this.posts, ...data.body];
          this.isLoading = false;
        },
        error: (err) => {
          console.error("Error:", err);
          this.isLoading = false;
        },
      });
  }

  onUserChange(user: string) {
    this.username = user;
  }
}
