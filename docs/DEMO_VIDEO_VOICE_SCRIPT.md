# ARGUS: 5-Minute Demonstration Video — Voice-Over Script

**Project Title**: ARGUS: Cyber Deception & Attack Monitoring Platform  
**Target Submission**: INSA Cyber Talent Center (CTC) Graduation Capstone 2026  
**Video File**: `output/argus_presentation_demo.mp4`  
**Video Quality**: 1920x1080 Full HD (H.264)  

---

## 🎙️ Recording Instructions for the Presenter

1. Open `output/argus_presentation_demo.mp4` on your computer in VLC, Windows Media Player, or your video editor (CapCut, Premiere, DaVinci, or Canva).
2. Play the video while reading the text below at a steady, confident, professional pace.
3. The timestamps indicate exactly which scene is appearing on the screen.

---

## ⏱️ Scene-by-Scene Voice-Over Script

### [0:00 – 0:25] Scene 1: Project Introduction & Team Information
*(Visual on screen: Dark Cyber Title Slide with Project Title and Team Members)*

> *"Good day, respected mentors and evaluation committee members. Welcome to the final demonstration of our graduation capstone project: **ARGUS — Cyber Deception & Attack-Monitoring System**.*
> 
> *Our project was developed at the **INSA Cyber Talent Center** by our team:*
> - *Goitom Shumey Gebremariam — Team Lead and Backend Architect.*
> - *Muaz Muhammed — Frontend Architect and Decoy UI Lead.*
> - *Zyad — Security Engineer and Forensics Lead.*
> 
> *Traditional cybersecurity relies heavily on passive perimeter defenses like firewalls and intrusion detection systems. Once an attacker breaches the perimeter, they can move laterally undetected. ARGUS flips this dynamic by deploying believable, fully isolated decoy surfaces that lure adversaries away from real infrastructure, slowing them down and capturing tamper-evident forensic intelligence in real time."*

---

### [0:25 – 0:50] Scene 2: Architectural Containment & Key Innovations
*(Visual on screen: Architecture Slide showing Containment, Zero DB, and Zero Plaintext)*

> *"The core engineering principle of ARGUS is **Absolute Containment**.*
> 
> *First: **Zero Database Access**. Our decoy systems have **no database credentials, ORM models, or connection strings**. Attackers who probe or compromise the decoy cannot access or query the telemetry database because all events are securely buffered in-memory and dispatched over an authenticated mutual API pipeline.*
> 
> *Second: **Zero-Plaintext Credential Policy**. When attackers attempt credential stuffing, ARGUS never logs plaintext passwords. Instead, we record password length and an HMAC-SHA256 fingerprint salted with an isolated server key. This enables forensic clustering of coordinated attacks without violating credential privacy.*
> 
> *Third: **Multi-Vector Decoy Fabric**. We deploy an authentic consumer retail banking portal—Geberew Bank—alongside scanner traps and an asynchronous raw TCP MySQL honeypot on port 3306."*

---

### [0:50 – 1:40] Scene 3: Geberew Bank Decoy Portal (ገበሬው ባንክ)
*(Visual on screen: Browser navigates to Geberew Bank, scrolls through features, toggles Amharic, and shows 3D Cards)*

> *"Here you see our primary web deception surface: **Geberew Bank (ገበሬው ባንክ)**.*
> 
> *Built with modern React, TypeScript, and Tailwind CSS, Geberew Bank presents the authentic appearance of an Ethiopian retail commercial bank. Notice the high-fidelity design, smooth typography, and authentic corporate branding.*
> 
> *Crucially, we have implemented **complete bilingual localization**. With one click, the entire portal transitions seamlessly into **Amharic (አማርኛ)**, complete with genuine Ge'ez terminology and National Bank of Ethiopia regulatory statements.*
> 
> *Navigating to the Cards page, we see interactive **3D card tilt and flip physics**. An automated attacker or manual penetration tester encounters a rich, highly responsive web application that maximizes dwell time and engagement, while leaking zero software identifiers or honeypot indicators."*

---

### [1:40 – 2:25] Scene 4: Attacker Exploitation & Deception Traps
*(Visual on screen: Attacker visits /bank/login, inputs bait credentials, triggers 2FA OTP modal, and runs automated simulation)*

> *"Now, let us examine how ARGUS traps active attacker exploitation.*
> 
> *An adversary discovers the online banking login portal and attempts to submit credentials. If they use one of our planted bait accounts—such as `j.hartwell`—the system escalates engagement by displaying a realistic **Two-Factor Authentication OTP challenge**, stating that a verification code was dispatched.*
> 
> *If the attacker attempts SQL injection—such as `' OR 1=1 --`—the input is intercepted, flagged as malicious, and safely isolated.*
> 
> *Simultaneously, our background multi-vector traffic simulator runs scanner probes against disallowed directories like `/.env`, `/.git`, and `robots.txt`, probes our **MySQL protocol honeypot on port 3306**, and tests file upload quarantining with streaming SHA-256 calculation."*

---

### [2:25 – 3:35] Scene 5: Real-Time SOC Monitoring Dashboard
*(Visual on screen: Logging into SOC Dashboard, WebSocket event stream, Deep Inspection Modal, MITRE ATT&CK Matrix, Intel Map)*

> *"Now, switching to the defender's perspective: this is the **ARGUS SOC Operations Dashboard**.*
> 
> *Connected via live, persistent WebSockets, the dashboard delivers instant situational awareness to security analysts without requiring manual page refreshes.*
> 
> *Notice our algorithmic **Threat Score gauge** and **Risk Level indicators** dynamically adapting as interactions arrive. Each event is classified with source IP, targeted path, and severity.*
> 
> *Clicking on an interaction opens the **Deep Event Inspection Modal**. Here, analysts can verify the attacker's sanitized headers, targeted service, and the HMAC password fingerprint—proving our zero-plaintext invariant in production.*
> 
> *Moving to the **MITRE ATT&CK Matrix view**, ARGUS automatically maps incoming activities to specific adversary tactics—including Reconnaissance (T1595), Initial Access (T1190), and Credential Stuffing (T1110).*
> 
> *On the **Intel Map**, analysts visualize the global geographical origin of all attacking IPs.*
> 
> *High and critical events also dispatch instant out-of-band alerts directly to our **Telegram Incident Bot (`@Deception_argusBot`)**, ensuring immediate operator notification.*
> 
> *Finally, analysts can generate a complete forensic dossier in PDF, CSV, or JSON format with a single click."*

---

### [3:35 – 4:00] Scene 6: Conclusion, Test Metrics & GitHub Submission
*(Visual on screen: Final Slide showing GitHub repository link, test passing badges, and CTC acknowledgment)*

> *"To ensure academic and engineering rigor, the ARGUS platform is backed by a comprehensive automated test suite. **All 372 unit and integration tests are passing with a 100% success rate**, verifying database isolation, protocol framing, rate limiting, and bundle hygiene.*
> 
> *The entire codebase, Docker orchestration, documentation, and evaluation guides are publicly available on GitHub at:*
> **`https://github.com/aprotovic/argus-deception-platform`**
> 
> *On behalf of Goitom, Muaz, and Zyad, thank you to our project mentors and the INSA Cyber Talent Center evaluation committee for your guidance and support throughout this capstone journey."*

---

## 🛠️ How to Add Your Voice to the Video

You can merge your voice with the video in 3 easy ways:

### Option A: Using CapCut (Free & Easiest)
1. Download or open CapCut (Desktop or Mobile).
2. Import `output/argus_presentation_demo.mp4`.
3. Click **Audio -> Record** (microphone icon).
4. Read the script above while watching the video.
5. Export the final video as `argus_final_submission.mp4`!

### Option B: Using Windows Video Editor / Clipchamp (Built into Windows 11)
1. Right-click `output/argus_presentation_demo.mp4` -> **Open with -> Clipchamp**.
2. Click **Record & Create -> Audio / Voiceover**.
3. Speak into your headset microphone while the video plays.
4. Export and save.

### Option C: Using FFmpeg (If you record an MP3 audio file on your phone)
If you record your voice as `voiceover.mp3` on your phone:
```bash
ffmpeg -i output/argus_presentation_demo.mp4 -i voiceover.mp3 -c:v copy -c:a aac -shortest output/argus_with_voice.mp4
```
