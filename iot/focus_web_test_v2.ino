/*
 * ============================================================
 *  FocusFlow IoT — V2 Firmware With Device Registration & Status
 * ============================================================
 *  
 *  Overview: Complete V2 firmware implementing the new API routes.
 *    - Registers itself on boot (`/api/hardware/register`)
 *    - Sends online heartbeat every 10s (`/api/hardware/status`)
 *    - Polls for active focus session every 5s (`/api/hardware`)
 *    - Analyzes local environment and pushes data every 10s if active
 *
 *  Libraries Required: ESP8266WiFi, ESP8266HTTPClient, ArduinoJson v7+, 
 *                      Adafruit GFX, Adafruit SSD1306, DHT, BH1750, FastLED
 * ============================================================
 */

#include <ESP8266WiFi.h>
#include <ESP8266HTTPClient.h>
#include <WiFiClient.h>
#include <ArduinoJson.h>

#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <DHT.h>
#include <BH1750.h>
#include <FastLED.h>

// ============================================================
//  CONFIGURATION
// ============================================================

// WiFi credentials (updated from your environment)
const char* WIFI_SSID      = "RYSERA";
const char* WIFI_PASSWORD  = "Rysera@123";

// API & Firebase
const char* API_BASE_URL   = "http://192.168.43.149:3000"; 
const char* DEVICE_TOKEN   = "focusflow-device-secret-2026";
const char* USER_UID       = "WzPW9tjYXKew6ucALd3BsgVzE1F3";

// Dynamic Device Info
String DEVICE_ID;

// ============================================================
//  HARDWARE PINS
// ============================================================

#define SCREEN_WIDTH  128
#define SCREEN_HEIGHT 64
#define OLED_RESET    -1

#define DHTPIN        14       // GPIO14
#define DHTTYPE       DHT22
#define MIC_PIN       A0       // ADC0
#define LED_PIN       12       // GPIO12
#define NUM_LEDS      8

// ============================================================
//  OBJECTS & STATE
// ============================================================

Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET);
DHT dht(DHTPIN, DHTTYPE); 
BH1750 lightMeter;
CRGB leds[NUM_LEDS];
WiFiClient wifiClient;

unsigned long previousMillisSensor    = 0;
unsigned long previousMillisOLED      = 0;
unsigned long previousMillisPoll      = 0;
unsigned long previousMillisPush      = 0;
unsigned long previousMillisHeartbeat = 0;

const long sensorInterval    = 2000;  // 2s
const long oledInterval      = 500;   // 0.5s
const long pollInterval      = 5000;  // 5s
const long pushInterval      = 10000; // 10s
const long heartbeatInterval = 10000; // 10s

float currentTemp   = 0.0;
float currentHum    = 0.0;
float currentLux    = 0.0;
int   noiseLevel    = 0;

int    suitabilityScore = 0;
String suitabilityTier  = "Unknown";

bool   sessionActive  = false;
String sessionId      = "";
bool   wifiConnected  = false;

// ============================================================
//  SCORING ALGORITHMS
// ============================================================

int scoreTemperature(float temp) {
  if (isnan(temp)) return 50;
  if (temp >= 24.0 && temp <= 28.0) return 100;
  
  float diff = (temp < 24.0) ? (24.0 - temp) : (temp - 28.0);
  // Subtract 10 points per degree deviation from the optimal range
  int score = round(100 - (diff * 10.0));
  return constrain(score, 0, 100);
}

int scoreHumidity(float hum) {
  if (isnan(hum)) return 50;
  if (hum >= 40.0 && hum <= 60.0) return 100;
  
  float diff = (hum < 40.0) ? (40.0 - hum) : (hum - 60.0);
  // Subtract 2 points per 1% deviation (e.g. 50% off = -100 points)
  int score = round(100 - (diff * 2.0));
  return constrain(score, 0, 100);
}

int scoreLight(float lux) {
  if (lux >= 300.0 && lux <= 500.0) return 100;
  
  float diff = (lux < 300.0) ? (300.0 - lux) : (lux - 500.0);
  // Subtract 0.2 points per lux deviation 
  // (e.g. 100 lux = -40 points, >1000 lux drops score fast)
  int score = round(100 - (diff * 0.2));
  return constrain(score, 0, 100);
}

int scoreNoise(int noise) {
  if (noise <= 2) return 100;
  // Subtract 10 points per noise unit above 2
  int score = 100 - ((noise - 2) * 10);
  return constrain(score, 0, 100);
}

void computeFocusSuitability() {
  int tempScore  = scoreTemperature(currentTemp);
  int humScore   = scoreHumidity(currentHum);
  int lightScore = scoreLight(currentLux);
  
  int normalizedNoise = constrain(map(noiseLevel, 0, 1023, 0, 10), 0, 10);
  int noiseScore = scoreNoise(normalizedNoise);
  
  // Weighted calculation for overall environment score
  float rawScore = (tempScore * 0.35) + (humScore * 0.15) + (lightScore * 0.25) + (noiseScore * 0.25);
  suitabilityScore = constrain((int)round(rawScore), 0, 100);
  
  if (suitabilityScore >= 85) suitabilityTier = "Excellent";
  else if (suitabilityScore >= 65) suitabilityTier = "Good";
  else if (suitabilityScore >= 40) suitabilityTier = "Fair";
  else suitabilityTier = "Poor";
}

// ============================================================
//  HARDWARE CONTROL
// ============================================================

void updateLEDStatus() {
  CRGB color;
  if (suitabilityTier == "Excellent") color = CRGB(0, 200, 200);
  else if (suitabilityTier == "Good") color = CRGB(0, 200, 50);
  else if (suitabilityTier == "Fair") color = CRGB(255, 140, 0);
  else color = CRGB(255, 30, 30);
  
  if (!sessionActive) color = CRGB(20, 20, 30);
  
  fill_solid(leds, NUM_LEDS, color);
  FastLED.show();
}

void monitorNoise() {
  unsigned int signalMax = 0;
  unsigned int signalMin = 1024;
  unsigned long startMillis = millis();
  
  while (millis() - startMillis < 50) {
    unsigned int sample = analogRead(MIC_PIN);
    if (sample < 1024) {
      if (sample > signalMax) signalMax = sample;
      if (sample < signalMin) signalMin = sample;
    }
  }
  noiseLevel = (noiseLevel + (signalMax - signalMin)) / 2;
}

// ============================================================
//  API COMMUNICATION (V2 ROUTES)
// ============================================================

void registerDevice() {
  if (!wifiConnected || WiFi.status() != WL_CONNECTED) return;
  
  HTTPClient http;
  String url = String(API_BASE_URL) + "/api/hardware/register";
  
  Serial.print("[REGISTER] POST ");
  Serial.println(url);
  
  JsonDocument doc;
  doc["uid"] = USER_UID;
  doc["deviceId"] = DEVICE_ID;
  doc["name"] = "Desk Monitor";
  doc["firmwareVersion"] = "1.0.1";
  
  String payload;
  serializeJson(doc, payload);
  
  http.begin(wifiClient, url);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("x-device-token", DEVICE_TOKEN);
  
  int httpCode = http.POST(payload);
  if (httpCode == HTTP_CODE_OK || httpCode == 201) {
    Serial.println("[REGISTER] Success");
  } else {
    Serial.print("[REGISTER] Failed: ");
    Serial.println(httpCode);
    Serial.println(http.getString());
  }
  http.end();
}

void sendHeartbeat() {
  if (!wifiConnected || WiFi.status() != WL_CONNECTED) return;
  
  HTTPClient http;
  String url = String(API_BASE_URL) + "/api/hardware/status";
  
  JsonDocument doc;
  doc["uid"] = USER_UID;
  doc["deviceId"] = DEVICE_ID;
  
  String payload;
  serializeJson(doc, payload);
  
  http.begin(wifiClient, url);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("x-device-token", DEVICE_TOKEN);
  
  int httpCode = http.POST(payload);
  if (httpCode == HTTP_CODE_OK) {
    Serial.println("[HEARTBEAT] OK");
  } else {
    Serial.print("[HEARTBEAT] Failed: ");
    Serial.println(httpCode);
  }
  http.end();
}

void pollForActiveSession() {
  if (!wifiConnected || WiFi.status() != WL_CONNECTED) return;
  
  HTTPClient http;
  String url = String(API_BASE_URL) + "/api/hardware?uid=" + String(USER_UID);
  
  http.begin(wifiClient, url);
  http.addHeader("x-device-token", DEVICE_TOKEN);
  
  int httpCode = http.GET();
  if (httpCode == HTTP_CODE_OK) {
    JsonDocument doc;
    DeserializationError error = deserializeJson(doc, http.getString());
    
    if (!error) {
      bool wasActive = sessionActive;
      sessionActive = doc["active"].as<bool>();
      
      if (sessionActive) {
        sessionId = doc["sessionId"].as<String>();
        if (!wasActive) Serial.println("[POLL] New session detected!");
      } else {
        sessionId = "";
      }
    }
  }
  http.end();
}

void pushEnvironmentData() {
  if (!wifiConnected || !sessionActive || sessionId.length() == 0) return;
  
  HTTPClient http;
  String url = String(API_BASE_URL) + "/api/hardware";
  
  JsonDocument doc;
  doc["uid"] = USER_UID;
  doc["sessionId"] = sessionId;
  doc["deviceId"] = DEVICE_ID;
  
  JsonObject env = doc["environment"].to<JsonObject>();
  env["temperature"] = round(currentTemp * 10.0) / 10.0;
  env["humidity"]    = round(currentHum * 10.0) / 10.0;
  env["lightLevel"]  = (int)currentLux;
  env["noiseLevel"]  = constrain(map(noiseLevel, 0, 1023, 0, 10), 0, 10);
  env["suitabilityScore"] = suitabilityScore;
  env["focusSuitability"] = suitabilityTier;
  
  String payload;
  serializeJson(doc, payload);
  
  Serial.println("[PUSH] Sending env data...");
  
  http.begin(wifiClient, url);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("x-device-token", DEVICE_TOKEN);
  
  int httpCode = http.POST(payload);
  if (httpCode != HTTP_CODE_OK) {
    Serial.print("[PUSH] Failed: ");
    Serial.println(httpCode);
  }
  http.end();
}

// ============================================================
//  OS / WIFI
// ============================================================

void connectWiFi() {
  Serial.print("Connecting to WiFi: ");
  Serial.println(WIFI_SSID);
  
  display.clearDisplay();
  display.setCursor(0, 0); display.println("FocusFlow IoT V2");
  display.drawLine(0, 10, 128, 10, WHITE);
  display.setCursor(0, 20); display.println("Connecting WiFi...");
  display.display();
  
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  
  int retries = 0;
  while (WiFi.status() != WL_CONNECTED && retries < 20) {
    delay(500);
    Serial.print(".");
    retries++;
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    wifiConnected = true;
    Serial.println("\nWiFi Connected!");
    
    display.clearDisplay();
    display.setCursor(0, 20); display.println("WiFi Connected!");
    display.setCursor(0, 35); display.print("IP: "); display.println(WiFi.localIP());
    display.display();
    
    // Auto-Register Device on the Next.js API
    registerDevice();
    
    delay(2000);
  } else {
    wifiConnected = false;
    Serial.println("\nWiFi FAILED.");
  }
}

void updateDisplay() {
  display.clearDisplay();
  
  // Header
  display.setCursor(10, 0); display.print("FocusFlow");
  display.setCursor(90, 0); display.print(wifiConnected ? "V2_OK" : "OFFL");
  display.drawLine(0, 10, 128, 10, WHITE);
  
  // Status Bar
  display.setCursor(0, 13);
  display.print(sessionActive ? "SESSION ACTIVE" : "Waiting for session");
  display.drawLine(0, 22, 128, 22, WHITE);
  
  // Sensor Data
  display.setCursor(0, 25);
  display.print("T:"); display.print(currentTemp, 1); display.print("C  ");
  display.print("H:"); display.print(currentHum, 0);  display.print("%");
  
  display.setCursor(0, 35);
  display.print("L:"); display.print(currentLux, 0);  display.print("lx ");
  display.print("N:"); display.print(constrain(map(noiseLevel, 0, 1023, 0, 10), 0, 10)); display.print("/10");
  
  // Result
  display.drawLine(0, 45, 128, 45, WHITE);
  display.setCursor(0, 48);
  if (sessionActive) {
    display.print("Score: "); display.print(suitabilityScore); display.print("/100");
    display.setCursor(0, 57); display.print("> "); display.print(suitabilityTier);
  } else {
    display.print("Device ID: ");
    display.setCursor(0, 57); display.print(DEVICE_ID);
  }
  display.display();
}

// ============================================================
//  MAIN
// ============================================================

void setup() {
  Serial.begin(115200);
  
  // Generate distinct Device ID from MAC/Chip
  DEVICE_ID = "esp-" + String(ESP.getChipId(), HEX);
  Serial.println("\n\nStarting FocusFlow IoT V2...");
  Serial.print("Generated Device ID: ");
  Serial.println(DEVICE_ID);

  Wire.begin(4, 5);
  dht.begin();
  lightMeter.begin();
  
  display.begin(SSD1306_SWITCHCAPVCC, 0x3C);
  
  FastLED.addLeds<WS2812B, LED_PIN, GRB>(leds, NUM_LEDS);
  FastLED.setBrightness(30);
  updateLEDStatus(); // Set to standby dim
  
  connectWiFi();
}

void loop() {
  unsigned long currentMillis = millis();
  
  monitorNoise();
  
  if (currentMillis - previousMillisSensor >= sensorInterval) {
    previousMillisSensor = currentMillis;
    currentTemp = dht.readTemperature();
    currentHum  = dht.readHumidity();
    currentLux  = lightMeter.readLightLevel();
    computeFocusSuitability();
    updateLEDStatus();
  }
  
  if (currentMillis - previousMillisPoll >= pollInterval) {
    previousMillisPoll = currentMillis;
    pollForActiveSession();
  }
  
  if (currentMillis - previousMillisPush >= pushInterval) {
    previousMillisPush = currentMillis;
    pushEnvironmentData();
  }

  // V2: Heartbeat Ping
  if (currentMillis - previousMillisHeartbeat >= heartbeatInterval) {
    previousMillisHeartbeat = currentMillis;
    sendHeartbeat();
  }
  
  if (currentMillis - previousMillisOLED >= oledInterval) {
    previousMillisOLED = currentMillis;
    updateDisplay();
  }
  
  if (wifiConnected && WiFi.status() != WL_CONNECTED) {
    connectWiFi();
  }
}
