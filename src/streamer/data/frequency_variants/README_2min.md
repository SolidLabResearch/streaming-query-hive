# 2-Minute Frequency Variants for Smartphone & Wearable Acceleration X Data

Generated 2-minute test datasets with different frequencies for analysis.

## Data Sources

- **Smartphone**: acceleration X from SM-G950F device (extended from 15s original)
- **Wearable**: acceleration X from E4.A03846.Accelerometer (extended from 15s original)

## Duration

Each dataset contains exactly **2 minutes (120 seconds)** of data.
Original 15-second patterns are repeated cyclically to reach 2 minutes.

## Generated Frequencies

- **4Hz**: 250.0ms intervals (~480 data points)
- **8Hz**: 125.0ms intervals (~960 data points)
- **16Hz**: 62.5ms intervals (~1920 data points)
- **32Hz**: 31.2ms intervals (~3840 data points)
- **64Hz**: 15.6ms intervals (~7680 data points)
- **128Hz**: 7.8ms intervals (~15360 data points)

## Files

- `smartphone-acceleration-x-4Hz-2min.nt`: Smartphone X-axis at 4Hz (~480 points)
- `wearable-acceleration-x-4Hz-2min.nt`: Wearable X-axis at 4Hz (~480 points)
- `smartphone-acceleration-x-8Hz-2min.nt`: Smartphone X-axis at 8Hz (~960 points)
- `wearable-acceleration-x-8Hz-2min.nt`: Wearable X-axis at 8Hz (~960 points)
- `smartphone-acceleration-x-16Hz-2min.nt`: Smartphone X-axis at 16Hz (~1920 points)
- `wearable-acceleration-x-16Hz-2min.nt`: Wearable X-axis at 16Hz (~1920 points)
- `smartphone-acceleration-x-32Hz-2min.nt`: Smartphone X-axis at 32Hz (~3840 points)
- `wearable-acceleration-x-32Hz-2min.nt`: Wearable X-axis at 32Hz (~3840 points)
- `smartphone-acceleration-x-64Hz-2min.nt`: Smartphone X-axis at 64Hz (~7680 points)
- `wearable-acceleration-x-64Hz-2min.nt`: Wearable X-axis at 64Hz (~7680 points)
- `smartphone-acceleration-x-128Hz-2min.nt`: Smartphone X-axis at 128Hz (~15360 points)
- `wearable-acceleration-x-128Hz-2min.nt`: Wearable X-axis at 128Hz (~15360 points)

## Usage for Analysis

These 2-minute datasets enable:
- **Longer performance testing**: Sustained streaming query performance over 2 minutes
- **Memory usage analysis**: Study memory consumption patterns over time
- **Accuracy convergence**: Analyze how accuracy improves with more data
- **Resource scaling**: Evaluate CPU and memory scaling with data volume
- **Throughput analysis**: Measure sustained processing rates
- **Cross-device comparison**: Compare smartphone vs. wearable over longer periods

## Data Characteristics

- **Format**: N-Triples RDF
- **Duration**: Exactly 2 minutes per dataset
- **Timestamps**: ISO 8601 with microsecond precision
- **Values**: Float precision (smartphone: 7 decimals, wearable: 1 decimal)
- **Pattern extension**: Original 15s patterns repeated cyclically
- **Resampling**: Nearest-neighbor interpolation
- **Device identifiers**: Preserved from original data
