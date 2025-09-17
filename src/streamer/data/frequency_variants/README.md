# Frequency Variants for Smartphone & Wearable Acceleration X Data

Generated test datasets with different frequencies for analysis.

## Data Sources

- **Smartphone**: acceleration X from SM-G950F device
- **Wearable**: acceleration X from E4.A03846.Accelerometer

## Generated Frequencies

- **4Hz**: 250.0ms intervals
- **8Hz**: 125.0ms intervals
- **16Hz**: 62.5ms intervals
- **32Hz**: 31.2ms intervals
- **64Hz**: 15.6ms intervals
- **128Hz**: 7.8ms intervals

## Files

- `smartphone-acceleration-x-4Hz.nt`: Smartphone X-axis at 4Hz
- `wearable-acceleration-x-4Hz.nt`: Wearable X-axis at 4Hz
- `smartphone-acceleration-x-8Hz.nt`: Smartphone X-axis at 8Hz
- `wearable-acceleration-x-8Hz.nt`: Wearable X-axis at 8Hz
- `smartphone-acceleration-x-16Hz.nt`: Smartphone X-axis at 16Hz
- `wearable-acceleration-x-16Hz.nt`: Wearable X-axis at 16Hz
- `smartphone-acceleration-x-32Hz.nt`: Smartphone X-axis at 32Hz
- `wearable-acceleration-x-32Hz.nt`: Wearable X-axis at 32Hz
- `smartphone-acceleration-x-64Hz.nt`: Smartphone X-axis at 64Hz
- `wearable-acceleration-x-64Hz.nt`: Wearable X-axis at 64Hz
- `smartphone-acceleration-x-128Hz.nt`: Smartphone X-axis at 128Hz
- `wearable-acceleration-x-128Hz.nt`: Wearable X-axis at 128Hz

## Usage for Analysis

These datasets enable:
- **Performance testing**: Compare streaming query performance across frequencies
- **Accuracy analysis**: Study precision vs. frequency trade-offs
- **Resource usage**: Evaluate memory and CPU usage at different data rates
- **Cross-device comparison**: Analyze smartphone vs. wearable data patterns
- **Approximation studies**: Test approximation algorithms under varying loads

## Data Characteristics

- **Format**: N-Triples RDF
- **Timestamps**: ISO 8601 with microsecond precision
- **Values**: Float precision (smartphone: 7 decimals, wearable: 1 decimal)
- **Resampling**: Nearest-neighbor interpolation
- **Device identifiers**: Preserved from original data
