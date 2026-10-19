# ARGUS: Known Limitations & Future Roadmap

## 1. Current Limitations (v1.0 MVP)

### 1.1 Emulated Decoy Surface
- **Limited Interaction Depth**: The MVP implements a realistic HTTP-based corporate login portal and diagnostic payload upload interface. It does not emulate full interactive SSH, RDP, or deep multi-tier web application workflows (e.g., dynamic database backend simulation or synthetic document management systems).
- **Static Decoy Identity**: The default persona is configured as "Nexis Defense Core Portal". Advanced honeypot persona randomization across multiple corporate domains is left for subsequent iterations.

### 1.2 Payload Analysis
- **Static Safe Quarantine**: ARGUS stores uploaded files in a safe, non-executable quarantine with SHA-256 calculation and MIME detection. It deliberately does not perform automated dynamic malware detonation (e.g., Cuckoo or CAPE Sandbox integration) on the application host to avoid VM breakout or host compromise risks.

### 1.3 Threat Intelligence & Geolocation
- **Strictly In-the-Wild Observational Telemetry**: In accordance with the project guidelines, ARGUS displays genuine, observed network telemetry and does not synthesize or fabricate threat actor personas, APT classifications, or speculative geographic locations without an authenticated MaxMind GeoLite2 or IP intelligence provider configured.

---

## 2. Future Roadmap

1. **Automated Sandbox Pipeline**: Integration with an off-host, air-gapped sandbox cluster via webhook dispatch for dynamic behavioral analysis.
2. **Deceptive Honeytokens**: Injection of synthetic canary AWS keys, fake database credentials, and canary tokens into the decoy responses to trace data exfiltration.
3. **Decoy Cluster Multi-Tenancy**: Support for running multiple heterogeneous decoy personalities (e.g., healthcare portal, SCADA web interface, cloud console) managed from a single ARGUS command center.
