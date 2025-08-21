#!/usr/bin/env python3

import re
from datetime import datetime
import matplotlib.pyplot as plt
import matplotlib.dates as mdates
from pathlib import Path

def parse_nt_file(file_path):
    """Parse N-Triples file and extract timestamp and acceleration values."""
    data_points = []
    
    # Patterns to match timestamp and value
    timestamp_pattern = r'<https://saref\.etsi\.org/core/hasTimestamp>\s+"([^"]+)"\^\^<http://www\.w3\.org/2001/XMLSchema#dateTime>'
    value_pattern = r'<https://saref\.etsi\.org/core/hasValue>\s+"([^"]+)"\^\^<http://www\.w3\.org/2001/XMLSchema#float>'
    
    with open(file_path, 'r') as file:
        current_timestamp = None
        current_value = None
        
        for line in file:
            line = line.strip()
            if not line or line.startswith('#'):
                continue
                
            # Look for timestamp
            timestamp_match = re.search(timestamp_pattern, line)
            if timestamp_match:
                timestamp_str = timestamp_match.group(1)
                try:
                    current_timestamp = datetime.fromisoformat(timestamp_str.replace('Z', '+00:00'))
                except ValueError:
                    current_timestamp = datetime.strptime(timestamp_str.replace('Z', ''), '%Y-%m-%dT%H:%M:%S.%f')
            
            # Look for value
            value_match = re.search(value_pattern, line)
            if value_match:
                try:
                    current_value = float(value_match.group(1))
                except ValueError:
                    current_value = None
            
            # If we have both timestamp and value, add to data
            if current_timestamp is not None and current_value is not None:
                data_points.append((current_timestamp, current_value))
                current_timestamp = None
                current_value = None
    
    return data_points

def create_wearable_plot():
    """Create a plot specifically for wearable acceleration data."""
    file_path = "src/streamer/data/wearable.acceleration.x/data.nt"
    
    print(f"Processing: {file_path}")
    data_points = parse_nt_file(file_path)
    
    if not data_points:
        print("No data points found!")
        return
    
    # Sort by timestamp
    data_points.sort(key=lambda x: x[0])
    timestamps = [point[0] for point in data_points]
    values = [point[1] for point in data_points]
    
    # Create the plot
    plt.figure(figsize=(14, 8))
    plt.plot(timestamps, values, 'b-', linewidth=2, alpha=0.8, label='Wearable Acceleration X')
    plt.scatter(timestamps, values, c='red', s=15, alpha=0.6, label='Data Points')
    
    # Format the plot
    plt.title('Wearable Acceleration Data (X-axis)\nData Evolution Over Time', fontsize=16, fontweight='bold')
    plt.xlabel('Timestamp', fontsize=14)
    plt.ylabel('Acceleration Value', fontsize=14)
    plt.grid(True, alpha=0.3)
    plt.legend(fontsize=12)
    
    # Format x-axis to show time nicely
    plt.gca().xaxis.set_major_formatter(mdates.DateFormatter('%H:%M:%S'))
    plt.gca().xaxis.set_major_locator(mdates.SecondLocator(interval=2))
    plt.xticks(rotation=45)
    
    # Calculate and display statistics
    mean_val = sum(values) / len(values)
    min_val = min(values)
    max_val = max(values)
    std_val = (sum((x - mean_val) ** 2 for x in values) / len(values)) ** 0.5
    
    stats_text = f'''Statistics:
Count: {len(values)}
Mean: {mean_val:.2f}
Min: {min_val:.2f}
Max: {max_val:.2f}
Std Dev: {std_val:.2f}
Range: {max_val - min_val:.2f}'''
    
    plt.text(0.02, 0.98, stats_text, transform=plt.gca().transAxes, 
            verticalalignment='top', fontsize=11,
            bbox=dict(boxstyle='round', facecolor='lightblue', alpha=0.8))
    
    plt.tight_layout()
    
    # Save the plot
    output_file = "wearable_acceleration_plot.png"
    plt.savefig(output_file, dpi=300, bbox_inches='tight')
    print(f"Plot saved to: {output_file}")
    
    # Also show statistics in console
    print(f"\n=== Wearable Acceleration Statistics ===")
    print(f"Data Points: {len(values)}")
    print(f"Time Range: {timestamps[0]} to {timestamps[-1]}")
    print(f"Duration: {timestamps[-1] - timestamps[0]}")
    print(f"Mean Value: {mean_val:.6f}")
    print(f"Min Value: {min_val:.6f}")
    print(f"Max Value: {max_val:.6f}")
    print(f"Std Deviation: {std_val:.6f}")
    print(f"Range: {max_val - min_val:.6f}")

if __name__ == "__main__":
    create_wearable_plot()
