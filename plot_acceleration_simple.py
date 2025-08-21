#!/usr/bin/env python3

import re
from datetime import datetime
import argparse
from pathlib import Path

def parse_nt_file(file_path):
    """
    Parse N-Triples file and extract timestamp and acceleration values.
    
    Returns:
        list of tuples: [(timestamp, value), ...]
    """
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
                # Parse ISO format: "2025-07-15T07:50:23.4390Z"
                try:
                    current_timestamp = datetime.fromisoformat(timestamp_str.replace('Z', '+00:00'))
                except ValueError:
                    # Try alternative parsing if needed
                    current_timestamp = datetime.strptime(timestamp_str.replace('Z', ''), '%Y-%m-%dT%H:%M:%S.%f')
            
            # Look for value
            value_match = re.search(value_pattern, line)
            if value_match:
                try:
                    current_value = float(value_match.group(1))
                except ValueError:
                    current_value = None
            
            # If we have both timestamp and value for this observation, add to data
            if current_timestamp is not None and current_value is not None:
                data_points.append((current_timestamp, current_value))
                current_timestamp = None
                current_value = None
    
    return data_points

def analyze_data(data_points, title="Acceleration Data"):
    """
    Analyze acceleration data and print statistics.
    
    Args:
        data_points: List of (timestamp, value) tuples
        title: Dataset title
    """
    if not data_points:
        print("No data points found!")
        return
    
    # Sort by timestamp
    data_points.sort(key=lambda x: x[0])
    
    # Separate timestamps and values
    timestamps = [point[0] for point in data_points]
    values = [point[1] for point in data_points]
    
    # Calculate statistics
    count = len(values)
    mean_val = sum(values) / count
    min_val = min(values)
    max_val = max(values)
    std_val = (sum((x - mean_val) ** 2 for x in values) / count) ** 0.5
    
    # Time range
    time_start = timestamps[0]
    time_end = timestamps[-1]
    duration = time_end - time_start
    
    print(f"\n=== {title} ===")
    print(f"Data Points: {count}")
    print(f"Time Range: {time_start} to {time_end}")
    print(f"Duration: {duration}")
    print(f"Mean Value: {mean_val:.6f}")
    print(f"Min Value: {min_val:.6f}")
    print(f"Max Value: {max_val:.6f}")
    print(f"Std Deviation: {std_val:.6f}")
    print(f"Range: {max_val - min_val:.6f}")
    
    # Print first few and last few values
    print(f"\nFirst 5 values:")
    for i in range(min(5, count)):
        print(f"  {timestamps[i]}: {values[i]:.6f}")
    
    if count > 5:
        print(f"\nLast 5 values:")
        for i in range(max(0, count-5), count):
            print(f"  {timestamps[i]}: {values[i]:.6f}")

def save_csv(data_points, output_file):
    """Save data points to CSV file."""
    with open(output_file, 'w') as f:
        f.write("timestamp,value\n")
        for timestamp, value in sorted(data_points, key=lambda x: x[0]):
            f.write(f"{timestamp.isoformat()},{value}\n")
    print(f"Data saved to CSV: {output_file}")

def main():
    parser = argparse.ArgumentParser(description="Analyze acceleration data from N-Triples files")
    parser.add_argument("files", nargs='+', help="N-Triples file(s) to analyze")
    parser.add_argument("--csv", help="Save data to CSV file")
    parser.add_argument("--plot", action="store_true", help="Create plot (requires matplotlib)")
    
    args = parser.parse_args()
    
    # Validate files exist
    for file_path in args.files:
        if not Path(file_path).exists():
            print(f"Error: File not found: {file_path}")
            return
    
    all_data = []
    
    for file_path in args.files:
        print(f"\nProcessing: {file_path}")
        data_points = parse_nt_file(file_path)
        title = f"Acceleration Data: {Path(file_path).stem}"
        analyze_data(data_points, title)
        all_data.extend(data_points)
        
        # Save individual CSV if requested
        if args.csv and len(args.files) == 1:
            save_csv(data_points, args.csv)
    
    # Save combined CSV if multiple files
    if args.csv and len(args.files) > 1:
        save_csv(all_data, args.csv)
    
    # Create plot if requested
    if args.plot:
        try:
            import matplotlib.pyplot as plt
            import matplotlib.dates as mdates
            
            if len(args.files) == 1:
                plot_single_dataset(all_data, f"Acceleration Data: {Path(args.files[0]).stem}")
            else:
                plot_multiple_datasets(args.files)
                
        except ImportError:
            print("\nTo create plots, install matplotlib:")
            print("pip install matplotlib")

def plot_single_dataset(data_points, title):
    """Plot single dataset (requires matplotlib)."""
    import matplotlib.pyplot as plt
    import matplotlib.dates as mdates
    
    if not data_points:
        print("No data points to plot!")
        return
    
    # Sort by timestamp
    data_points.sort(key=lambda x: x[0])
    timestamps = [point[0] for point in data_points]
    values = [point[1] for point in data_points]
    
    plt.figure(figsize=(12, 8))
    plt.plot(timestamps, values, 'b-', linewidth=1, alpha=0.7, label='Acceleration Values')
    plt.scatter(timestamps, values, c='red', s=10, alpha=0.5, label='Data Points')
    
    plt.title(f'{title}\nData Evolution Over Time', fontsize=14, fontweight='bold')
    plt.xlabel('Timestamp', fontsize=12)
    plt.ylabel('Acceleration Value', fontsize=12)
    plt.grid(True, alpha=0.3)
    plt.legend()
    
    # Format x-axis
    plt.gca().xaxis.set_major_formatter(mdates.DateFormatter('%H:%M:%S'))
    plt.xticks(rotation=45)
    
    # Add statistics
    mean_val = sum(values) / len(values)
    min_val = min(values)
    max_val = max(values)
    std_val = (sum((x - mean_val) ** 2 for x in values) / len(values)) ** 0.5
    
    stats_text = f'Count: {len(values)}\nMean: {mean_val:.4f}\nMin: {min_val:.4f}\nMax: {max_val:.4f}\nStd: {std_val:.4f}'
    plt.text(0.02, 0.98, stats_text, transform=plt.gca().transAxes, 
            verticalalignment='top', bbox=dict(boxstyle='round', facecolor='wheat', alpha=0.8))
    
    plt.tight_layout()
    plt.show()

def plot_multiple_datasets(file_paths):
    """Plot multiple datasets for comparison (requires matplotlib)."""
    import matplotlib.pyplot as plt
    import matplotlib.dates as mdates
    
    plt.figure(figsize=(14, 10))
    colors = ['blue', 'red', 'green', 'orange', 'purple', 'brown']
    
    for i, file_path in enumerate(file_paths):
        data_points = parse_nt_file(file_path)
        if not data_points:
            continue
            
        data_points.sort(key=lambda x: x[0])
        timestamps = [point[0] for point in data_points]
        values = [point[1] for point in data_points]
        
        color = colors[i % len(colors)]
        label = Path(file_path).stem
        plt.plot(timestamps, values, color=color, linewidth=1, alpha=0.7, label=label)
    
    plt.title('Acceleration Data Comparison', fontsize=14, fontweight='bold')
    plt.xlabel('Timestamp', fontsize=12)
    plt.ylabel('Acceleration Value', fontsize=12)
    plt.grid(True, alpha=0.3)
    plt.legend()
    
    plt.gca().xaxis.set_major_formatter(mdates.DateFormatter('%H:%M:%S'))
    plt.xticks(rotation=45)
    
    plt.tight_layout()
    plt.show()

if __name__ == "__main__":
    main()
