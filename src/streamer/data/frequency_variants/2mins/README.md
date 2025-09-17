# 2-Minute Frequency Variants - Organized Structure

This directory contains 2-minute acceleration X-axis datasets organized by device type and frequency for easy analysis.

## Directory Structure

```
2mins/
├── smartphone/
│   ├── 4Hz/data.nt      (480 observations)
│   ├── 8Hz/data.nt      (960 observations)
│   ├── 16Hz/data.nt     (1,920 observations)
│   ├── 32Hz/data.nt     (3,840 observations)
│   ├── 64Hz/data.nt     (7,679 observations)
│   └── 128Hz/data.nt    (15,358 observations)
└── wearable/
    ├── 4Hz/data.nt      (480 observations)
    ├── 8Hz/data.nt      (960 observations)
    ├── 16Hz/data.nt     (1,920 observations)
    ├── 32Hz/data.nt     (3,840 observations)
    ├── 64Hz/data.nt     (7,679 observations)
    └── 128Hz/data.nt    (15,359 observations)
```

## Data Specifications

### Duration
- **Exactly 2 minutes (120 seconds)** per dataset
- Extended from original 15-second patterns through cyclical repetition

### Device Types
- **Smartphone**: Samsung SM-G950F acceleration X-axis
- **Wearable**: E4.A03846.Accelerometer acceleration X-axis

### Frequencies & Intervals
| Frequency | Interval | Expected Points | Smartphone Points | Wearable Points |
|-----------|----------|----------------|-------------------|-----------------|
| 4Hz       | 250.0ms  | ~480           | 480               | 480             |
| 8Hz       | 125.0ms  | ~960           | 960               | 960             |
| 16Hz      | 62.5ms   | ~1,920         | 1,920             | 1,920           |
| 32Hz      | 31.2ms   | ~3,840         | 3,840             | 3,840           |
| 64Hz      | 15.6ms   | ~7,680         | 7,679             | 7,679           |
| 128Hz     | 7.8ms    | ~15,360        | 15,358            | 15,359          |

## Usage Examples

### Loading Specific Frequency Data
```bash
# Load smartphone 64Hz data
cat 2mins/smartphone/64Hz/data.nt

# Load wearable 16Hz data  
cat 2mins/wearable/16Hz/data.nt
```

### Batch Processing All Frequencies
```bash
# Process all smartphone frequencies
for freq in 4Hz 8Hz 16Hz 32Hz 64Hz 128Hz; do
    echo "Processing smartphone $freq..."
    # Your processing command here using 2mins/smartphone/$freq/data.nt
done

# Process all wearable frequencies
for freq in 4Hz 8Hz 16Hz 32Hz 64Hz 128Hz; do
    echo "Processing wearable $freq..."
    # Your processing command here using 2mins/wearable/$freq/data.nt
done
```

### Cross-Device Frequency Comparison
```bash
# Compare same frequency across devices
echo "Comparing 32Hz across devices:"
wc -l 2mins/smartphone/32Hz/data.nt 2mins/wearable/32Hz/data.nt
```

## Analysis Applications

### Performance Testing
- **Path**: `2mins/{device}/{frequency}/data.nt`
- **Use Case**: Test streaming query performance at different data rates
- **Duration**: 2-minute sustained processing tests

### Memory Usage Analysis
- **Benefit**: Longer duration reveals memory patterns and potential leaks
- **Frequency Impact**: Higher frequencies stress memory allocation

### Accuracy Convergence Studies
- **Compare**: How accuracy improves over the 2-minute period
- **Cross-frequency**: Different convergence rates at different Hz

### Resource Scaling Evaluation
- **CPU Usage**: Sustained processing load over 2 minutes
- **Memory Growth**: Track memory consumption patterns
- **Throughput**: Measure sustained processing rates

### Device Comparison Studies
- **Same Frequency**: Compare smartphone vs wearable at identical Hz
- **Cross-device Performance**: Identify device-specific processing characteristics

## Data Format

- **Format**: N-Triples RDF (.nt files)
- **Timestamps**: ISO 8601 with microsecond precision
- **Values**: 
  - Smartphone: 7 decimal places (e.g., `2.1623042`)
  - Wearable: 1 decimal place (e.g., `12.4`)
- **Time Range**: 2025-07-15T07:50:23.439Z to 2025-07-15T07:52:23.189Z
- **Pattern**: Original 15-second data repeated 8 times cyclically

## File Naming Convention

- **Path Pattern**: `2mins/{device}/{frequency}/data.nt`
- **Device**: `smartphone` | `wearable`
- **Frequency**: `4Hz` | `8Hz` | `16Hz` | `32Hz` | `64Hz` | `128Hz`
- **Filename**: Always `data.nt` for consistency

This organized structure makes it easy to:
1. **Select specific device-frequency combinations**
2. **Batch process by device or frequency**
3. **Compare across devices at same frequency**
4. **Scale analysis scripts across all combinations**
5. **Maintain consistent file paths in automation**
