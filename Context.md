# Focus - Productivity Hub Context

## Overview
**Focus** is a self-aware productivity system designed to combat digital distraction and improve deep work. Rather than relying on simple timers or "all-or-nothing" app blockers that generate anxiety, Focus acts as a calm, intelligent desk companion. By seamlessly integrating hardware and software, it monitors both the physical environment and digital activity to gently nudge the user back to productivity. 

The system prioritizes privacy by utilizing local processing and AI/ML algorithms to adapt to user habits, building long-term mental resilience.

## Core Components

### 1. Hardware Desk Companion (The "Anchor")
A smart, physical docking station for the user's smartphone. 
- **Microcontroller:** ESP32-S3 (or similar) handles networking, sensor polling, and basic processing.
- **Sensors:** 
  - **Presence/Proximity:** ToF/IR sensors, along with BT/Wi-Fi to detect when the phone is docked.
  - **Environment:** BME680 (or DHT22/BMP280) for temperature/humidity/air quality, and BH1750 for ambient light.
  - **Vision/Posture:** OV2640 or ESP-CAM to detect whether the user is slouching, fidgeting, or in a focused posture.
- **Feedback Mechanisms:** Soft interventions are provided via WS2812B RGB ambient LEDs and a DFPlayer Mini (or phone speaker) for non-intrusive sound cues.

### 2. Web Extension
A browser extension that acts as the "Digital Tracking" layer.
- Continuously monitors active tabs, screen content, and typing patterns.
- Analyzes digital behavior to determine if the user is focused or drifting (e.g., erratic tab switching or prolonged time on social media).
- Feeds local telemetry to the core system to evaluate the user's focus state without transmitting sensitive data to the cloud.

### 3. Web Application Dashboard
The central hub for the user to view insights, set goals, and connect the ecosystem.
- Built with **Next.js, React 19, Tailwind CSS v4, Recharts**, and **Firebase**.
- Provides visual analytics on focus sessions, environmental data (temperature, light), and posture health.
- Allows users to set "Anchors" (personal goals and reminders) that the system uses to gently remind them when they are distracted.
- Interfaces with both the web extension and the hardware module.

## Workflow 
1. **Docking:** The user places their phone on the hardware dock, signaling the start of a deep work session.
2. **Context Gathering:** Hardware sensors map the physical environment while the web extension tracks digital activity.
3. **Smart Adaptation:** AI/ML algorithms (running locally) determine if the user is losing focus based on both physiological signs (slouching) and digital behavior (scrolling).
4. **Calm Interventions:** If a break is needed or focus is lost, the hardware emits gentle lighting or sound cues, while the web app/extension provides supportive reminders of their "Anchors".
5. **Continuous Learning:** Over time, the model tunes itself to the user's personal habits for increased efficacy.
