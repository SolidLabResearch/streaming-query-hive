#!/usr/bin/env python3

import re
import matplotlib.pyplot as plt
import matplotlib.dates as mdates
from datetime import datetime
import argparse
from pathlib import Path
import pandas as pd

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

def plot_acceleration_data(data_points, title="Acceleration Data", output_file=None):
    """
    Plot acceleration data over time.
    
    Args:
        data_points: List of (timestamp, value) tuples
        title: Plot title
        output_file: Optional file to save plot
    """
    if not data_points:
        print("No data points found to plot!")
        return
    
    # Sort by timestamp
    data_points.sort(key=lambda x: x[0])
    
    # Separate timestamps and values
    timestamps = [point[0] for point in data_points]
    values = [point[1] for point in data_points]
    
    # Create the plot
    plt.figure(figsize=(12, 8))
    plt.plot(timestamps, values, 'b-', linewidth=1, alpha=0.7, label='Acceleration Values')
    plt.scatter(timestamps, values, c='red', s=10, alpha=0.5, label='Data Points')
    
    # Format the plot
    plt.title(f'{title}\nData Evolution Over Time', fontsize=14, fontweight='bold')
    plt.xlabel('Timestamp', fontsize=12)
    plt.ylabel('Acceleration Value', fontsize=12)
    plt.grid(True, alpha=0.3)
    plt.legend()
    
    # Format x-axis to show time nicely
    plt.gca().xaxis.set_major_formatter(mdates.DateFormatter('%H:%M:%S'))
    plt.gca().xaxis.set_major_locator(mdates.SecondLocator(interval=5))
    plt.xticks(rotation=45)
    
    # Add statistics as text
    if values:
        mean_val = sum(values) / len(values)
        min_val = min(values)
        max_val = max(values)
        std_val = (sum((x - mean_val) ** 2 for x in values) / len(values)) ** 0.5
        
        stats_text = f'Count: {len(values)}\nMean: {mean_val:.4f}\nMin: {min_val:.4f}\nMax: {max_val:.4f}\nStd: {std_val:.4f}'
        plt.text(0.02, 0.98, stats_text, transform=plt.gca().transAxes, 
                verticalalignment='top', bbox=dict(boxstyle='round', facecolor='wheat', alpha=0.8))
    
    plt.tight_layout()
    
    # Save or show the plot
    if output_file:
        plt.savefig(output_file, dpi=300, bbox_inches='tight')
        print(f"Plot saved to: {output_file}")
    else:
        plt.show()

def compare_datasets(file_paths, labels=None, output_file=None):
    """
    Compare multiple datasets on the same plot.
    
    Args:
        file_paths: List of file paths
        labels: List of labels for each dataset
        output_file: Optional file to save plot
    """
    if labels is None:
        labels = [f'Dataset {i+1}' for i in range(len(file_paths))]
    
    plt.figure(figsize=(14, 10))
    colors = ['blue', 'red', 'green', 'orange', 'purple', 'brown']
    
    all_stats = []
    
    for i, (file_path, label) in enumerate(zip(file_paths, labels)):
        print(f"Processing {label}: {file_path}")
        data_points = parse_nt_file(file_path)
        
        if not data_points:
            print(f"No data found in {file_path}")
            continue
            
        # Sort by timestamp
        data_points.sort(key=lambda x: x[0])
        timestamps = [point[0] for point in data_points]
        values = [point[1] for point in data_points]
        
        color = colors[i % len(colors)]
        plt.plot(timestamps, values, color=color, linewidth=1, alpha=0.7, label=label)
        
        # Calculate statistics
        if values:
            mean_val = sum(values) / len(values)
            min_val = min(values)
            max_val = max(values)
            std_val = (sum((x - mean_val) ** 2 for x in values) / len(values)) ** 0.5
            all_stats.append(f'{label}: Mean={mean_val:.3f}, Std={std_val:.3f}')
    
    # Format the plot
    plt.title('Acceleration Data Comparison\nMultiple Datasets Over Time', fontsize=14, fontweight='bold')
    plt.xlabel('Timestamp', fontsize=12)
    plt.ylabel('Acceleration Value', fontsize=12)
    plt.grid(True, alpha=0.3)
    plt.legend()
    
    # Format x-axis
    plt.gca().xaxis.set_major_formatter(mdates.DateFormatter('%H:%M:%S'))
    plt.gca().xaxis.set_major_locator(mdates.SecondLocator(interval=5))
    plt.xticks(rotation=45)
    
    # Add statistics
    if all_stats:
        stats_text = '\n'.join(all_stats)
        plt.text(0.02, 0.98, stats_text, transform=plt.gca().transAxes, 
                verticalalignment='top', bbox=dict(boxstyle='round', facecolor='lightblue', alpha=0.8))
    
    plt.tight_layout()
    
    # Save or show the plot
    if output_file:
        plt.savefig(output_file, dpi=300, bbox_inches='tight')
        print(f"Comparison plot saved to: {output_file}")
    else:
        plt.show()

def main():
    parser = argparse.ArgumentParser(description="Plot acceleration data from N-Triples files")
    parser.add_argument("files", nargs='+', help="N-Triples file(s) to plot")
    parser.add_argument("--output", "-o", help="Output file to save the plot")
    parser.add_argument("--compare", "-c", action="store_true", 
                       help="Compare multiple files on the same plot")
    parser.add_argument("--labels", nargs='+', 
                       help="Labels for datasets (when comparing)")
    
    args = parser.parse_args()
    
    # Validate files exist
    for file_path in args.files:
        if not Path(file_path).exists():
            print(f"Error: File not found: {file_path}")
            return
    
    if args.compare or len(args.files) > 1:
        # Compare multiple datasets
        labels = args.labels if args.labels else [Path(f).stem for f in args.files]
        compare_datasets(args.files, labels, args.output)
    else:
        # Plot single dataset
        data_points = parse_nt_file(args.files[0])
        title = f"Acceleration Data: {Path(args.files[0]).stem}"
        plot_acceleration_data(data_points, title, args.output)

if __name__ == "__main__":
    main()
