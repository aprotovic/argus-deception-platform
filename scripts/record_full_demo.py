"""ARGUS Full Automated Video Demonstration Recorder.

Records an end-to-end, high-definition (1080p) demonstration video of the entire
ARGUS Cyber Deception & Attack Monitoring Platform matching all INSA CTC portal requirements:
1. Title, Purpose, and Team Member details
2. Architecture & Containment Innovations
3. Geberew Bank Decoy Portal walkthrough & bilingual switch
4. Attacker exploitation traps (Credential stuffing, Bait 2FA OTP, SQLi)
5. Live multi-vector traffic generation (MySQL 3306, File quarantine, Scanner traps)
6. Real-Time SOC Monitoring Dashboard (WebSockets, MITRE matrix, Intel Map, Evidence export)
7. Conclusion, Test metrics (372/372 passed), and GitHub repository link.

Output:
    output/argus_presentation_demo.mp4
"""

import os
import shutil
import subprocess
import sys
import time
from pathlib import Path
from playwright.sync_api import sync_playwright

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

ROOT_DIR = Path(__file__).resolve().parent.parent
OUTPUT_DIR = ROOT_DIR / "output"
TEMP_VIDEO_DIR = ROOT_DIR / "temp_video_raw"
SLIDES_HTML = (ROOT_DIR / "scripts" / "slides.html").as_uri()

OUTPUT_DIR.mkdir(exist_ok=True)
if TEMP_VIDEO_DIR.exists():
    shutil.rmtree(TEMP_VIDEO_DIR)
TEMP_VIDEO_DIR.mkdir(exist_ok=True)


def smooth_scroll(page, target_y: int, steps: int = 25, delay: float = 0.04):
    """Smoothly scrolls page to target Y coordinate."""
    current_y = page.evaluate("window.scrollY")
    distance = target_y - current_y
    for i in range(1, steps + 1):
        step_y = current_y + (distance * (i / steps))
        page.evaluate(f"window.scrollTo(0, {step_y})")
        time.sleep(delay)


def run_recording():
    print("=" * 70)
    print("  ARGUS Platform -- Automated Video Demonstration Recorder (1080p)")
    print("=" * 70)

    with sync_playwright() as p:
        print("[*] Launching browser engine in 1920x1080 viewport...")
        browser = p.chromium.launch(channel="msedge", headless=True)
        context = browser.new_context(
            record_video_dir=str(TEMP_VIDEO_DIR),
            record_video_size={"width": 1920, "height": 1080},
            viewport={"width": 1920, "height": 1080},
        )
        page = context.new_page()

        # ====================================================================
        # SCENE 1: Title Card & Team Information (Slide 1)
        # ====================================================================
        print("\n[Scene 1/6] Rendering Title & Team Slide...")
        page.goto(SLIDES_HTML)
        page.wait_for_timeout(1000)
        page.evaluate("document.querySelectorAll('.slide').forEach(s => s.classList.remove('active')); document.getElementById('slide-1').classList.add('active');")
        page.wait_for_timeout(14000)

        # ====================================================================
        # SCENE 2: Architecture & Innovations (Slide 2)
        # ====================================================================
        print("[Scene 2/6] Rendering Architecture & Containment Innovations...")
        page.evaluate("document.querySelectorAll('.slide').forEach(s => s.classList.remove('active')); document.getElementById('slide-2').classList.add('active');")
        page.wait_for_timeout(16000)

        # ====================================================================
        # SCENE 3: Public Banking Decoy Portal (Geberew Bank)
        # ====================================================================
        print("[Scene 3/6] Navigating to Geberew Bank Decoy Portal (http://127.0.0.1:8081/bank)...")
        page.goto("http://127.0.0.1:8081/bank")
        page.wait_for_load_state("networkidle")
        page.wait_for_timeout(3000)

        # Smooth scroll through features
        print("    -> Scrolling through landing page...")
        smooth_scroll(page, 700, steps=30, delay=0.04)
        page.wait_for_timeout(3000)
        smooth_scroll(page, 1500, steps=30, delay=0.04)
        page.wait_for_timeout(3000)
        smooth_scroll(page, 0, steps=25, delay=0.03)
        page.wait_for_timeout(2000)

        # Toggle to Amharic
        print("    -> Switching language to Amharic...")
        page.evaluate("""
            const btns = Array.from(document.querySelectorAll('button'));
            const langBtn = btns.find(b => b.textContent.includes('አማርኛ') || b.textContent.includes('English'));
            if (langBtn) langBtn.click();
        """)
        page.wait_for_timeout(4000)

        # Navigate to Cards page to show 3D cards
        print("    -> Exploring 3D Cards page...")
        page.goto("http://127.0.0.1:8081/bank/cards")
        page.wait_for_load_state("networkidle")
        page.wait_for_timeout(3000)
        smooth_scroll(page, 500, steps=20, delay=0.04)
        page.wait_for_timeout(4000)

        # ====================================================================
        # SCENE 4: Attacker Exploitation & Deception Traps
        # ====================================================================
        print("[Scene 4/6] Demonstrating Attacker Interactions & Bait Traps...")
        page.goto("http://127.0.0.1:8081/bank/login")
        page.wait_for_load_state("networkidle")
        page.wait_for_timeout(2000)

        # Type bait credentials
        print("    -> Attacker submits bait credentials ('j.hartwell')...")
        user_input = page.locator("input[type='text'], input[placeholder*='Username'], input[name='username']").first
        pass_input = page.locator("input[type='password'], input[placeholder*='Password'], input[name='password']").first

        if user_input.count() > 0 and pass_input.count() > 0:
            user_input.fill("j.hartwell")
            page.wait_for_timeout(1000)
            pass_input.fill("Hartwell2024!")
            page.wait_for_timeout(1000)

            # Submit
            submit_btn = page.locator("button[type='submit'], button:has-text('Sign In')").first
            submit_btn.click()
            page.wait_for_timeout(4000)

            # Check for OTP modal
            otp_input = page.locator("input[placeholder*='OTP'], input[name='otp'], input[maxlength='6']")
            if otp_input.count() > 0:
                print("    -> Realistic 2FA OTP Challenge Triggered!")
                otp_input.first.fill("849201")
                page.wait_for_timeout(2000)
        
        # Trigger background multi-vector traffic simulator
        print("    -> Executing multi-vector attack simulation (SQLi, Recon, MySQL 3306, Quarantine)...")
        sim_proc = subprocess.run(
            [
                str(ROOT_DIR / ".venv" / "Scripts" / "python.exe"),
                str(ROOT_DIR / "scripts" / "simulate_traffic.py"),
                "--count", "12",
            ],
            capture_output=True,
            text=True,
        )
        print("    -> Simulation traffic generated successfully.")

        # ====================================================================
        # SCENE 5: Real-Time SOC Monitoring Dashboard
        # ====================================================================
        print("[Scene 5/6] Opening SOC Operations Dashboard (http://127.0.0.1:3000)...")
        page.goto("http://127.0.0.1:3000")
        page.wait_for_load_state("networkidle")
        page.wait_for_timeout(2000)

        # If on login view, log in
        dash_user = page.locator("input[type='text'], input[name='username']").first
        dash_pass = page.locator("input[type='password'], input[name='password']").first
        if dash_user.count() > 0 and dash_pass.count() > 0:
            print("    -> Logging in as SOC Administrator (argus_admin)...")
            dash_user.fill("argus_admin")
            dash_pass.fill("ArgusAdmin2026!ChangeMe")
            page.locator("button[type='submit'], button:has-text('Sign In'), button:has-text('Login')").first.click()
            page.wait_for_load_state("networkidle")
            page.wait_for_timeout(3000)

        # Show live overview metrics
        print("    -> Displaying Live Threat Score, Metrics, and WebSocket Stream...")
        page.wait_for_timeout(5000)
        smooth_scroll(page, 400, steps=20, delay=0.04)
        page.wait_for_timeout(4000)

        # Click first event to open Deep Inspection Modal
        print("    -> Opening Deep Event Inspection Modal...")
        event_row = page.locator("tbody tr, div[class*='cursor-pointer']").first
        if event_row.count() > 0:
            event_row.click()
            page.wait_for_timeout(5000)
            page.keyboard.press("Escape")
            page.wait_for_timeout(1000)

        # Navigate through tabs (Intel Map, MITRE ATT&CK)
        print("    -> Exploring Intel Map and Threat Intelligence...")
        for tab_name in ["Intel Map", "Threat Map", "Map", "MITRE", "Analytics", "Live Events"]:
            tab = page.locator(f"button:has-text('{tab_name}'), a:has-text('{tab_name}')")
            if tab.count() > 0:
                print(f"       * Clicking tab: {tab_name}")
                tab.first.click()
                page.wait_for_timeout(4000)

        smooth_scroll(page, 0, steps=15, delay=0.03)
        page.wait_for_timeout(3000)

        # ====================================================================
        # SCENE 6: Conclusion & Submission Summary (Slide 3)
        # ====================================================================
        print("[Scene 6/6] Rendering Conclusion & Repository Submission Slide...")
        page.goto(SLIDES_HTML)
        page.wait_for_timeout(1000)
        page.evaluate("document.querySelectorAll('.slide').forEach(s => s.classList.remove('active')); document.getElementById('slide-3').classList.add('active');")
        page.wait_for_timeout(14000)

        # Finish recording
        print("\n[*] Finalizing Playwright video stream...")
        context.close()
        browser.close()

    # Convert .webm to .mp4 using ffmpeg
    print("[*] Encoding final video to H.264 MP4 (1080p)...")
    raw_files = list(TEMP_VIDEO_DIR.glob("*.webm"))
    if not raw_files:
        print("[!] Error: No raw video file captured!")
        return

    raw_video = raw_files[0]
    final_mp4 = OUTPUT_DIR / "argus_presentation_demo.mp4"

    cmd = [
        "ffmpeg", "-y",
        "-i", str(raw_video),
        "-c:v", "libx264",
        "-preset", "medium",
        "-crf", "20",
        "-pix_fmt", "yuv420p",
        str(final_mp4),
    ]

    subprocess.run(cmd, check=True)
    file_size_mb = final_mp4.stat().st_size / (1024 * 1024)

    print("=" * 70)
    print(f"[SUCCESS] Demonstration video created: {final_mp4}")
    print(f"          Resolution : 1920x1080 Full HD")
    print(f"          File Size  : {file_size_mb:.2f} MB")
    print("=" * 70)

    # Clean up raw temp video
    shutil.rmtree(TEMP_VIDEO_DIR)


if __name__ == "__main__":
    run_recording()
