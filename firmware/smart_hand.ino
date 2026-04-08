#include <Wire.h>
#include <Adafruit_PWMServoDriver.h>

// PCA9685 driver — default I2C address 0x40
Adafruit_PWMServoDriver pwm = Adafruit_PWMServoDriver();

// Servo pulse range (adjust after calibration)
#define SERVO_MIN 150  // pulse length for 0 degrees
#define SERVO_MAX 600  // pulse length for 180 degrees
#define NUM_SERVOS 5

String inputBuffer = "";

void setup() {
  Serial.begin(115200);
  pwm.begin();
  pwm.setPWMFreq(50); // Standard servo frequency

  // Move all servos to 90 degrees (neutral) on startup
  for (int i = 0; i < NUM_SERVOS; i++) {
    setServoAngle(i, 90);
  }

  Serial.println("READY");
}

void loop() {
  while (Serial.available()) {
    char c = Serial.read();
    if (c == '\n') {
      processCommand(inputBuffer);
      inputBuffer = "";
    } else {
      inputBuffer += c;
    }
  }
}

void processCommand(String cmd) {
  cmd.trim();
  if (cmd.length() == 0) return;

  // Parse format: "S0:90,S1:45,S2:120,S3:90,S4:60"
  int servo = 0;
  int startIdx = 0;

  while (startIdx < (int)cmd.length() && servo < NUM_SERVOS) {
    // Find "S<n>:" prefix
    int colonIdx = cmd.indexOf(':', startIdx);
    if (colonIdx == -1) break;

    // Find end of value (comma or end of string)
    int commaIdx = cmd.indexOf(',', colonIdx);
    if (commaIdx == -1) commaIdx = cmd.length();

    // Extract angle value
    String valueStr = cmd.substring(colonIdx + 1, commaIdx);
    int angle = valueStr.toInt();
    angle = constrain(angle, 0, 180);

    setServoAngle(servo, angle);
    servo++;
    startIdx = commaIdx + 1;
  }

  Serial.println("OK");
}

void setServoAngle(int channel, int angle) {
  int pulse = map(angle, 0, 180, SERVO_MIN, SERVO_MAX);
  pwm.setPWM(channel, 0, pulse);
}
