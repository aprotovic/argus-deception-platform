# Requirements Document

## Introduction

Meridian Trust Bank is a fictional online banking honeypot portal built on top of the existing ARGUS Cyber Deception Platform. It presents as a fully professional, modern retail bank to lure attackers, credential stuffers, and phishing operators into interacting with deceptive surfaces while the ARGUS backend silently captures all telemetry. Every interaction — from page visit to login attempt to document upload — is logged as a structured SecurityEvent with zero plaintext credential storage.

The portal complements the existing Nexis Defense Systems military decoy that is already deployed on port 8080. Meridian Trust Bank is served from the same FastAPI process using distinct URL routes, a new DecoyService record, and new HTML templates under `decoy/templates/bank/`. It does not modify or break any existing Nexis endpoints.

## Glossary

- **Bank_Portal**: The Meridian Trust Bank decoy web application served to internet-facing attackers.
- **ARGUS_Backend**: The FastAPI core service on port 8000 with PostgreSQL, telemetry storage, and WebSocket broadcasting.
- **Decoy_Service**: The `argus-decoy` Docker container running on port 8080 that hosts both the Nexis and Bank_Portal decoys.
- **SecurityEvent**: The existing immutable telemetry record stored in PostgreSQL; see `backend/app/models/security_event.py`.
- **Telemetry_Engine**: The combination of database writes, WebSocket broadcast, and structured logging that records attacker activity.
- **Quarantine**: The safe non-executable file storage managed by `backend/app/core/quarantine.py` using UUID filenames, SHA-256 hashing, and chmod 0600.
- **Rate_Limiter**: The existing `SlidingWindowRateLimiter` instance in `backend/app/core/rate_limiter.py`.
- **Password_Fingerprint**: An HMAC-SHA256 digest computed server-side from the attacker's submitted password using `compute_password_fingerprint()`. Plaintext is never stored.
- **Honeytoken**: A piece of fake but believable credential or document embedded in Bank_Portal responses to detect data exfiltration.
- **OTP_Challenge**: A fake one-time passcode step presented after successful fake login credential matching, designed to capture additional attacker behavior.
- **KYC_Upload**: A fake Know-Your-Customer document upload form that routes uploaded files through the Quarantine pipeline.
- **SQLi_Detector**: The input-analysis logic that scans submitted strings for SQL injection patterns.
- **XSS_Detector**: The input-analysis logic that scans submitted strings for cross-site scripting payloads.
- **Fake_Account**: A hardcoded fictional bank account with plausible account numbers, balances, and transaction history shown after a simulated successful login.
- **WCAG_AA**: Web Content Accessibility Guidelines 2.1 Level AA, the accessibility compliance target.

---

## Requirements

### Requirement 1: Multi-Page Bank Portal Routing

**User Story:** As an ARGUS operator, I want the Bank_Portal to serve multiple distinct pages at clean URLs, so that attackers experience a realistic multi-page banking application.

#### Acceptance Criteria

1. WHEN a GET request is made to `/bank`, THE Bank_Portal SHALL respond with HTTP 200 and a `text/html` content-type body containing the public landing page.
2. WHEN a GET request is made to `/bank/login`, THE Bank_Portal SHALL respond with HTTP 200 and a `text/html` content-type body containing the customer login page.
3. WHEN a GET request is made to `/bank/recover`, THE Bank_Portal SHALL respond with HTTP 200 and a `text/html` content-type body containing the password recovery page.
4. WHEN a GET request is made to `/bank/dashboard` without a valid session token in the request, THE Bank_Portal SHALL respond with HTTP 302 redirecting the requester to `/bank/login`.
5. WHEN a GET request is made to `/bank/transfer`, THE Bank_Portal SHALL respond with HTTP 200 and a `text/html` content-type body containing the fund transfer page.
6. WHEN a GET request is made to `/bank/statements`, THE Bank_Portal SHALL respond with HTTP 200 and a `text/html` content-type body containing the account statements page.
7. WHEN a GET request is made to `/bank/support`, THE Bank_Portal SHALL respond with HTTP 200 and a `text/html` content-type body containing the customer support page.
8. WHEN a GET request is made to any `/bank/*` path not matching a defined route, THE Bank_Portal SHALL respond with HTTP 404 and a `text/html` content-type body that includes the Bank_Portal site navigation and branding elements present on defined pages.
9. THE Bank_Portal SHALL not include in any served HTML response — including page text, headings, labels, meta tags, and HTML comments — any of the terms "honeypot", "decoy", "ARGUS", "demo", "test environment", or "simulation".

---

### Requirement 2: Visual Design System

**User Story:** As an ARGUS operator, I want the Bank_Portal to look and feel indistinguishable from a legitimate professional retail bank, so that attackers do not suspect a trap.

#### Acceptance Criteria

1. THE Bank_Portal SHALL apply a deep navy color (`#0f2044`) as the primary brand color for navigation bars, headings, and primary buttons, and a teal color (`#0d9488`) as the accent color for interactive elements, links, and highlights, on all pages.
2. THE Bank_Portal SHALL load Inter (weights 400, 500, 600, 700) as the body typeface and Playfair Display (weights 400, 600, 700) as the heading typeface on all pages.
3. THE Bank_Portal SHALL display an SVG logo representing a stylized "M" letterform or abstract financial motif using the brand palette, placed in the site header on every page alongside the text "Meridian Trust Bank".
4. THE Bank_Portal SHALL use a spacing scale of 8px, 16px, 24px, 32px, 48px, and 64px; no padding, margin, or gap value outside this set SHALL appear in the rendered layout.
5. THE Bank_Portal SHALL render content panels as white cards with a visible soft shadow, distinguishing them from the page background on all screen sizes.
6. WHEN a user hovers over or focuses an interactive element, THE Bank_Portal SHALL apply the visual state change within 150ms to 200ms.
7. WHEN the viewport width is 640px or less, THE Bank_Portal SHALL stack all multi-column layouts into a single column and ensure touch targets are at least 44×44px.
8. WHEN the viewport width is between 641px and 1023px, THE Bank_Portal SHALL render content in a two-column layout where applicable.
9. WHEN the viewport width is 1024px or greater, THE Bank_Portal SHALL render content in the full desktop layout with sidebar or multi-column arrangements.
10. THE Bank_Portal SHALL comply with WCAG_AA contrast requirements: all normal text SHALL have a minimum contrast ratio of 4.5:1 against its background; all large text SHALL have a minimum contrast ratio of 3:1.
11. THE Bank_Portal SHALL include visible focus indicators on all interactive elements (buttons, inputs, links) meeting WCAG_AA focus visibility requirements.
12. THE Bank_Portal SHALL render professional trust badge elements (SSL Secured, FDIC Insured, 256-bit encryption, 24/7 fraud monitoring) in the footer area on the landing page and login page.

---

### Requirement 3: Public Landing Page

**User Story:** As an ARGUS operator, I want a realistic bank landing page, so that attackers and scanners perceive Meridian Trust Bank as a genuine financial institution worth targeting.

#### Acceptance Criteria

1. THE Bank_Portal SHALL render a hero section on the landing page containing a headline, subheadline, a primary "Sign In" call-to-action button linking to `/bank/login`, and a secondary "Open an Account" call-to-action that renders as a non-navigating placeholder element.
2. THE Bank_Portal SHALL render a services section on the landing page listing at least four fictional banking services (Personal Checking, Savings Accounts, Mortgage, Business Banking), each with an icon and a description of no more than 160 characters.
3. THE Bank_Portal SHALL render a security/trust section on the landing page displaying at least three trust claims (FDIC Insured, 256-Bit SSL Encryption, Zero-Liability Fraud Protection).
4. THE Bank_Portal SHALL render a footer on every page containing: fictional bank registration details, a privacy policy link, a terms of service link, an accessibility link, a copyright notice, and at minimum two fictional regulatory badges.
5. WHEN a visitor submits an HTTP GET request to `/bank`, THE Telemetry_Engine SHALL record a SecurityEvent with event_type `recon_probe`, severity `low`, and `metadata_payload.decoy_brand` set to `"meridian_trust_bank"`.
6. IF the Telemetry_Engine fails to record a SecurityEvent when the landing page is loaded, THEN THE Bank_Portal SHALL still serve the landing page and SHALL log the recording failure internally without exposing the error to the visitor.

---

### Requirement 4: Customer Login Page

**User Story:** As an ARGUS operator, I want the login page to capture credential stuffing and brute-force attempts with zero plaintext storage, so that ARGUS telemetry reveals attacker tactics and tooling.

#### Acceptance Criteria

1. THE Bank_Portal SHALL render a login form with fields for "Online ID" (username) and "Password", a "Remember my Online ID" checkbox, and a "Sign In" submit button.
2. THE Bank_Portal SHALL render a "Forgot Password?" link on the login page that navigates to `/bank/recover`.
3. WHEN the login form is submitted, THE Bank_Portal SHALL validate that the Online ID field is not empty and the Password field length is between 1 and 256 characters before sending the API request.
4. IF the Online ID field is empty or the Password field length is outside 1 to 256 characters, THEN THE Bank_Portal SHALL display an inline validation error message indicating the invalid field and SHALL NOT submit the form to the API.
5. WHEN the login form is submitted and passes client-side validation, THE Bank_Portal SHALL send a POST request to `/api/v1/bank/auth/login` with the form fields as multipart form data.
6. WHEN a login attempt is received at `/api/v1/bank/auth/login`, THE Telemetry_Engine SHALL compute a Password_Fingerprint and record a LoginAttempt with `password_length` and `password_hmac_fingerprint`.
7. THE Telemetry_Engine SHALL never store or log the plaintext password from any login attempt received at `/api/v1/bank/auth/login`.
8. WHEN a login attempt is received at `/api/v1/bank/auth/login`, THE Telemetry_Engine SHALL record a SecurityEvent with event_type `login_attempt`, `metadata_payload.decoy_brand` set to `"meridian_trust_bank"`, and severity `medium`.
9. WHEN the submitted username and password match a configured Fake_Account credential pair, THE Bank_Portal SHALL return HTTP 200 with a response body indicating OTP challenge required and SHALL include a redirect instruction to `/bank/otp` in the response.
10. WHEN a SQL injection pattern (including `' OR`, `--`, `UNION SELECT`, `DROP`, `1=1`) is detected in the username or password field, THE Bank_Portal SHALL record a SecurityEvent with event_type `sql_injection` and severity `critical`, and SHALL return HTTP 401.
11. WHEN a XSS payload pattern (including `<script>`, `javascript:`, `onerror=`) is detected in the username or password field, THE Bank_Portal SHALL record a SecurityEvent with event_type `login_attempt`, severity `high`, and `metadata_payload.xss_detected` set to `true`.
12. WHEN a login attempt is received at `/api/v1/bank/auth/login`, THE Rate_Limiter SHALL increment the request count for the source IP address against a limit of 10 requests per 60-second window.
13. IF the source IP address exceeds 10 login requests within a 60-second window, THEN THE Bank_Portal SHALL return HTTP 429 with a response body containing a generic account-access-restricted message that does not reference rate limiting or technical system details.
14. WHEN a failed login attempt occurs for a non-matching credential, THE Bank_Portal SHALL return HTTP 401 with a response body containing a generic credential failure message that does not indicate whether the username or the password was the cause of the failure.

---

### Requirement 5: MFA / OTP Challenge

**User Story:** As an ARGUS operator, I want a fake multi-factor authentication step after successful credential bypass, so that ARGUS captures OTP guessing and MFA fatigue attack behavior.

#### Acceptance Criteria

1. WHEN a Fake_Account login succeeds, THE Bank_Portal SHALL display an OTP_Challenge page prompting the attacker to enter a 6-digit code, showing a masked fictional phone number that reveals only the last 2 digits (e.g., "••••••••12").
2. WHEN a Fake_Account login succeeds, THE Bank_Portal SHALL render the OTP_Challenge without a full page reload, using a client-side view transition within the existing page.
3. WHEN an OTP code is submitted to `/api/v1/bank/auth/otp`, THE Telemetry_Engine SHALL record a SecurityEvent with event_type `otp_attempt`, severity `high`, and `metadata_payload` containing the submitted code length, `decoy_brand`, and `username`.
4. WHEN an OTP submission contains exactly 6 digits, THE Bank_Portal SHALL respond with a verification-failed error indicating the code has expired and SHALL keep the attacker on the OTP_Challenge page.
5. IF an OTP submission contains fewer or more than 6 digits, THEN THE Bank_Portal SHALL respond with a validation error indicating the code must be exactly 6 digits and SHALL keep the attacker on the OTP_Challenge page.
6. WHEN a resend OTP action is triggered, THE Telemetry_Engine SHALL record a SecurityEvent with event_type `otp_attempt` and `metadata_payload.action` set to `"resend_requested"`.
7. THE Rate_Limiter SHALL enforce a maximum of 5 OTP submissions per IP address per 60-second window.
8. IF the OTP submission rate limit is exceeded, THEN THE Bank_Portal SHALL respond with HTTP 429 with a message indicating the account is temporarily locked, and SHALL reject further OTP submissions from that IP address for 60 seconds before resuming normal OTP_Challenge behavior.

---

### Requirement 6: Password Recovery Flow

**User Story:** As an ARGUS operator, I want to capture account enumeration attacks disguised as password recovery, so that ARGUS identifies attackers probing for valid accounts.

#### Acceptance Criteria

1. THE Bank_Portal SHALL render a password recovery page with a field for "Email Address or Online ID" accepting a maximum of 256 characters and a "Continue" submit button.
2. WHEN a recovery request is submitted to `/api/v1/bank/auth/recover`, THE Telemetry_Engine SHALL record a SecurityEvent with event_type `password_recovery_attempt`, severity `medium`, `metadata_payload.decoy_brand` set to `"meridian_trust_bank"`, and `metadata_payload.source_ip` set to the originating request IP address.
3. WHEN a recovery request is received, THE Bank_Portal SHALL return the confirmation message "If an account matching that information exists, you will receive an email shortly." regardless of whether the submitted identifier matches a Fake_Account.
4. IF a SQL injection or XSS pattern is detected in the recovery input field, THEN THE Telemetry_Engine SHALL record a SecurityEvent with severity `critical` and `metadata_payload.injection_detected` set to `true`, and THE Bank_Portal SHALL return an error response indicating the input was rejected without revealing the detection logic.
5. THE Rate_Limiter SHALL enforce a maximum of 5 recovery requests per IP address per 60-second fixed window.
6. IF the rate limit is exceeded, THEN THE Bank_Portal SHALL return HTTP 429.

---

### Requirement 7: Fake Authenticated Dashboard

**User Story:** As an ARGUS operator, I want a convincing post-login dashboard that shows fake account data, so that attackers who bypass authentication spend time on the decoy and reveal further attack techniques.

#### Acceptance Criteria

1. THE Bank_Portal SHALL render the dashboard page with at least two Fake_Account cards, each showing a masked account number in the format ••••XXXX (last 4 digits only), an account type label (e.g., "Checking", "Savings"), and a fictional balance in the range $1.00–$99,999.99.
2. THE Bank_Portal SHALL render a recent transactions table with at least 8 fictional transaction rows, each containing a date, description, a credit or debit amount in the range $0.01–$9,999.99, and a running balance.
3. THE Bank_Portal SHALL render a spending summary chart implemented in SVG or Canvas, displaying at least 3 named fictional spending categories (e.g., Dining, Utilities, Shopping) with associated values, without importing any external charting library.
4. WHEN the dashboard page is loaded, THE Bank_Portal SHALL display quick-action buttons for Transfer Funds, Pay Bills, Download Statement, and Request Card, each of which returns a "feature temporarily unavailable" inline message on click without navigating away.
5. THE Bank_Portal SHALL render a "Linked Cards" section showing at least one fictional debit card and one fictional credit card, each with a masked card number in the format •••• •••• •••• XXXX.
6. WHEN exactly one HTTP GET request is received at `/bank/dashboard`, THE Telemetry_Engine SHALL record exactly one SecurityEvent with event_type `recon_probe`, severity `medium`, `metadata_payload.page` set to `"bank_dashboard"`, and `metadata_payload.decoy_brand` set to `"meridian_trust_bank"`.
7. WHEN a GET request is made to `/bank/dashboard`, THE Bank_Portal SHALL respond with HTTP 200 and render a page that satisfies criteria 1 through 5 of this requirement without requiring any server-side session token.

---

### Requirement 8: Fund Transfer Page

**User Story:** As an ARGUS operator, I want a fake fund transfer form, so that ARGUS captures attacker behavior attempting to initiate fraudulent transactions.

#### Acceptance Criteria

1. THE Bank_Portal SHALL render a transfer form with fields for: "From Account" (dropdown of Fake_Accounts), "To Account / Routing Number" (maximum 34 characters), "Recipient Name" (maximum 100 characters), "Amount", and "Memo" (maximum 280 characters).
2. WHEN a transfer form is submitted to `/api/v1/bank/transfer`, THE Telemetry_Engine SHALL record a SecurityEvent with event_type `recon_probe`, severity `medium`, and `metadata_payload` containing `decoy_brand`, submitted amount, character length of the submitted routing number string, and recipient name truncated to a maximum of 60 characters.
3. WHEN a transfer form is submitted to `/api/v1/bank/transfer`, THE Bank_Portal SHALL return a "Transaction pending security review" response within 3 seconds and SHALL never execute any real financial operation.
4. IF the submitted amount field contains a value less than 0.01, greater than 1,000,000, or contains non-numeric characters, THEN THE Telemetry_Engine SHALL record a SecurityEvent with event_type `suspicious_transfer`, severity `high`, and `metadata_payload.suspicious_amount` set to `true`, in addition to the `recon_probe` event recorded per criterion 2.
5. IF SQL injection patterns are detected in any of the five transfer form fields defined in criterion 1, THEN THE Telemetry_Engine SHALL record a SecurityEvent with event_type `sql_injection` and severity `critical`.
6. IF the Telemetry_Engine fails to record a SecurityEvent for a transfer submission, THEN THE Bank_Portal SHALL still return the "Transaction pending security review" response and SHALL log an error indicating the telemetry recording failure.

---

### Requirement 9: Statements Page and KYC Document Upload

**User Story:** As an ARGUS operator, I want a statements download section and a KYC document upload form, so that ARGUS can capture malware uploads, tool staging, and attacker-provided document artifacts.

#### Acceptance Criteria

1. THE Bank_Portal SHALL render a statements page listing at least three fictional monthly statement entries, each displaying a statement date in "Month YYYY" format, a file size label in KB or MB (e.g., "245 KB"), and a download button.
2. WHEN a statement download button is clicked, THE Bank_Portal SHALL serve a PDF file containing a Honeytoken string of the format `ARGUS-HT-[UUID]` embedded in the document body text.
3. WHEN a statement download button is clicked, THE Telemetry_Engine SHALL record a SecurityEvent with event_type `honeytoken_accessed` and severity `critical`.
4. THE Bank_Portal SHALL render a KYC upload form with a zone that accepts files via drag-and-drop or click-to-browse, labeled with upload categories "Proof of Identity" and "Proof of Address".
5. WHEN a file is submitted via the KYC upload endpoint `/api/v1/bank/kyc/upload`, THE Quarantine system SHALL store the file using a UUID filename, calculate its SHA-256 hash, and apply chmod 0600 permissions to the stored file.
6. WHEN a KYC file upload is completed successfully, THE Telemetry_Engine SHALL record a SecurityEvent with event_type `file_upload`, severity `critical`, and `metadata_payload` containing `decoy_brand`, `sanitized_filename` (original filename stripped of path separators and truncated to 255 characters), `sha256_hash`, `file_size_bytes`, and `detected_mime_type`.
7. IF the uploaded file exceeds 10 MB or has a detected MIME type indicating executable content (ELF binary, PE executable, shell script, or PHP source), THEN THE Bank_Portal SHALL reject the upload with an error message indicating the file is unsupported for document verification purposes.
8. IF the uploaded file is rejected due to size or MIME type, THEN THE Telemetry_Engine SHALL record a SecurityEvent with event_type `file_upload_rejected`, severity `high`, and `metadata_payload` containing `decoy_brand`, `sanitized_filename`, `file_size_bytes`, `detected_mime_type`, and `rejection_reason`.
9. THE Bank_Portal SHALL accept KYC uploads only for files with extensions .jpg, .png, .pdf, .doc, or .docx, and SHALL display the list of accepted file types persistently within the upload zone.

---

### Requirement 10: Customer Support Page

**User Story:** As an ARGUS operator, I want a customer support page with a contact form, so that ARGUS captures social engineering attempts and reconnaissance queries submitted via the support channel.

#### Acceptance Criteria

1. THE Bank_Portal SHALL render a support page with: bank contact information (fictional phone, email, and address), a list of at least 5 frequently asked questions, and a contact form.
2. THE Bank_Portal contact form SHALL include fields for: "Full Name" (maximum 100 characters), "Email Address" (maximum 254 characters), "Subject" (dropdown with options: "Account Inquiry", "Loan Application", "Technical Support", "Fraud Report", "Other"), and "Message" (maximum 2000 characters); the form SHALL prevent submission if any field is empty or if "Email Address" does not match a valid email format.
3. WHEN a support form is submitted to `/api/v1/bank/support/contact`, THE Telemetry_Engine SHALL record a SecurityEvent with event_type `recon_probe`, severity `low`, and `metadata_payload` containing `decoy_brand`, subject category selected, and message length in characters.
4. IF the support form "Message" field contains SQL injection patterns (including `SELECT`, `INSERT`, `DROP`, `' OR`, `--`) or XSS patterns (including `<script>`, `javascript:`, `onerror=`), THEN THE Telemetry_Engine SHALL record a SecurityEvent with event_type `recon_probe`, severity `high`, and `metadata_payload.injection_detected` set to `true`.
5. WHEN a support form submission is received, THE Bank_Portal SHALL return HTTP 200 with the confirmation message "Thank you for contacting us. A representative will respond within 2 business days." regardless of any backend processing errors.

---

### Requirement 11: Telemetry Integration and WebSocket Broadcast

**User Story:** As an ARGUS SOC analyst, I want every Bank_Portal interaction to appear in the SOC dashboard in real time, so that I can monitor attacker behavior live.

#### Acceptance Criteria

1. WHEN any SecurityEvent is recorded by a Bank_Portal endpoint, THE Telemetry_Engine SHALL broadcast the event summary to all currently connected SOC clients via the existing WebSocket manager (`ws_manager.broadcast_event()`).
2. WHEN a SecurityEvent originates from a Bank_Portal endpoint, THE Telemetry_Engine SHALL include `metadata_payload.decoy_brand` set to `"meridian_trust_bank"` in that event.
3. WHEN a SecurityEvent is created by a Bank_Portal endpoint, THE Telemetry_Engine SHALL populate `source_ip` using `extract_client_ip()`, `headers_sanitized` using `sanitize_headers()`, and `source_port`, `http_method`, `request_path`, `user_agent`, and `query_params` from the incoming request.
4. WHEN a SecurityEvent is created by a Bank_Portal endpoint, THE Telemetry_Engine SHALL assign a `correlation_id` value as an 8-character alphanumeric string that is unique per request.
5. WHEN a SecurityEvent is created for a Bank_Portal interaction, THE Telemetry_Engine SHALL set `decoy_service_id` to the UUID of the Meridian Trust Bank DecoyService record.
6. IF no Meridian Trust Bank DecoyService record exists at the time a SecurityEvent is created, THEN THE Telemetry_Engine SHALL persist the event with `decoy_service_id` set to null and SHALL emit a warning log entry indicating the missing record.
7. IF any request field (source_ip, user_agent, headers) cannot be extracted from the incoming request, THEN THE Telemetry_Engine SHALL set the corresponding SecurityEvent field to null and SHALL continue recording the event.

---

### Requirement 12: Bank DecoyService Record

**User Story:** As an ARGUS operator, I want a dedicated DecoyService record for Meridian Trust Bank, so that Bank_Portal events are distinguishable from Nexis Defense events in the SOC dashboard.

#### Acceptance Criteria

1. WHEN the Bank_Portal application starts, THE Bank_Portal SHALL retrieve or create a DecoyService record with `name` = `"Meridian Trust Bank Portal"`, `portal_type` = `"online_banking_portal"`, and `banner_title` = `"Meridian Trust Bank"`, setting all three fields to the specified values if the record is newly created or if any of those fields differ from the specified values on an existing record.
2. THE Bank_Portal SHALL not modify or delete the existing Nexis Defense Systems DecoyService record.
3. WHEN the Bank_Portal application starts, THE Bank_Portal SHALL ensure the DecoyService record's `config_metadata` includes the keys `theme`, `version`, and `brand` with the values `"bank_navy_teal"`, `"2.1.0"`, and `"meridian_trust_bank"` respectively, preserving any additional keys already present in the record.
4. IF the DecoyService record cannot be retrieved or created due to a database error during startup, THEN THE Bank_Portal SHALL log an error message indicating the failure and abort startup.

---

### Requirement 13: Security Isolation Invariants

**User Story:** As an ARGUS operator, I want the Bank_Portal to maintain strict security isolation, so that no attacker action ever produces real authentication, real file execution, or real data exfiltration.

#### Acceptance Criteria

1. THE Bank_Portal SHALL never return a response that causes a server-side session entry to be written to any session store, cookie store, or database session table; all simulated "authenticated" state SHALL be managed exclusively in the attacker's browser sessionStorage.
2. THE Bank_Portal SHALL never execute, interpret, or shell out any uploaded file content; the Quarantine system SHALL write files to disk with chmod 0600 and SHALL never pass file contents to any subprocess or interpreter; IF an uploaded file exceeds 10 MB, THEN THE Bank_Portal SHALL reject it before any disk write occurs.
3. THE Bank_Portal SHALL never store plaintext passwords; all password processing SHALL use `compute_password_fingerprint()` and SHALL store only `password_length` and `password_hmac_fingerprint`.
4. THE Bank_Portal SHALL use database credentials and authentication secrets that are distinct from and inaccessible to the real ARGUS admin dashboard and all other ARGUS components.
5. WHEN SQL injection or XSS patterns are detected in any user input, THE Bank_Portal SHALL escape all HTML special characters (`<`, `>`, `&`, `"`, `'`) and strip SQL metacharacters before storing the value in `metadata_payload`, and SHALL truncate the stored value to a maximum of 2048 characters.
6. THE Bank_Portal SHALL apply rate limiting on all POST endpoints using the existing Rate_Limiter.
7. IF the Rate_Limiter is unavailable for a specific endpoint, THEN THE Bank_Portal SHALL apply a default limit of 20 requests per IP per 60-second window and SHALL return HTTP 429 with a generic error indication when that limit is exceeded.
8. THE Bank_Portal SHALL not expose any internal system information, stack traces, file system paths, or configuration values in HTTP responses.

---

### Requirement 14: Phased Implementation Structure

**User Story:** As a developer, I want the implementation divided into reviewable phases, so that each phase can be approved before continuing.

#### Acceptance Criteria

1. THE Bank_Portal implementation SHALL be developed on a git branch named `decoy-ui`.
2. WHEN Phase (a) is implemented, it SHALL deliver exactly the following and no other artifacts: a typography/spacing/color token stylesheet, a shared JS utilities bundle, the SVG logo, and the public landing page HTML template.
3. WHEN Phase (b) is implemented, it SHALL deliver the login page, the OTP challenge page, the password recovery page, and the four auth endpoints: login, logout, OTP verification, and password reset.
4. WHEN Phase (c) is implemented, it SHALL deliver the post-login dashboard page with at least 5 hardcoded fictional transaction rows, a spending chart, and account summary cards.
5. WHEN Phase (d) is implemented, it SHALL deliver the transfer page, statements page, KYC upload form, support page, and the four endpoints: transfer initiation, statement list, KYC file upload, and support inquiry submission.
6. WHEN Phase (e) is implemented, it SHALL deliver verified SecurityEvent creation per interaction, WebSocket broadcast per interaction, DecoyService association per event, and Password_Fingerprint computation per login attempt.
7. WHEN Phase (f) is implemented, it SHALL deliver at least one automated test for each of the following: login telemetry capture, SQL injection detection, KYC file quarantine, OTP attempt logging, and rate limit enforcement.
8. WHEN any phase is complete, the implementation SHALL pass all pre-existing automated tests without modification to those tests.
