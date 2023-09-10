const int moisturePin = A0;   // Analog pin for moisture sensor
const int redLedPin = 8;      // Digital pin for red LED
const int greenLedPin = 9;    // Digital pin for green LED
const int tmtSensorPin = A1;  // Analog pin for the TMT temperature sensor
const int orangeLedPin = 2;   // Digital pin for the orange LED
const int blueLedPin = 3;     // Digital pin for the blue LED

void setup() {
  pinMode(redLedPin, OUTPUT);
  pinMode(greenLedPin, OUTPUT);
  pinMode(orangeLedPin, OUTPUT);
  pinMode(blueLedPin, OUTPUT);
  Serial.begin(9600);
}

void loop() {
  // Read the moisture value from the sensor
  int moistureValue = analogRead(moisturePin);

  // Calculate the percentage moisture (0-100)
  int moisturePercentage = map(moistureValue, 0, 1023, 0, 100);

  // Print the moisture percentage to the serial monitor
  Serial.print("Moisture Percentage: ");
  Serial.print(moisturePercentage);
  Serial.println("%");

  // Check if moisture is below 60%
  if (moisturePercentage < 60) {
    digitalWrite(redLedPin, HIGH);    // Turn on the red LED
    digitalWrite(greenLedPin, LOW);   // Turn off the green LED
  } else {
    digitalWrite(redLedPin, LOW);     // Turn off the red LED
    digitalWrite(greenLedPin, HIGH);  // Turn on the green LED
  }

  // Read the temperature value from the sensor
  int temperatureValue = analogRead(tmtSensorPin);

  // Convert the analog value to temperature in degrees Celsius
  float temperatureCelsius = (temperatureValue / 1024.0) * 100.0;

  // Print the temperature to the serial monitor
  Serial.print("Temperature: ");
  Serial.print(temperatureCelsius);
  Serial.println("°C");

  // Check if the temperature is greater than or equal to 14°C
  if (temperatureCelsius >= 14.0) {
    digitalWrite(orangeLedPin, HIGH); // Turn on the orange LED
    digitalWrite(blueLedPin, LOW);    // Turn off the blue LED
  } else {
    digitalWrite(orangeLedPin, LOW);  // Turn off the orange LED
    digitalWrite(blueLedPin, HIGH);   // Turn on the blue LED
  }

  delay(2000);  // Delay for 2 seconds before taking another reading
}
