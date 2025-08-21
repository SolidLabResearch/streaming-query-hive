#!/usr/bin/env python3

import numpy as np
import math
import os
from pathlib import Path
from datetime import datetime, timedelta
import argparse
from typing import List, Tuple, Callable

class ApproximationTestDataGenerator:
    """
    Generate synthetic datasets with various mathematical patterns to test 
    approximation approach accuracy vs exact computation.
    """
    
    def __init__(self, base_output_path: str = "/Users/kushbisen/Code/streaming-query-hive/src/streamer/data/approximation_test"):
        self.base_output_path = Path(base_output_path)
        self.data_points = 10000  # Number of data points per dataset
        self.timestamp_interval_ms = 33

        # Test scenarios
        self.challenging_patterns = {
            'exponential_growth': self.generate_exponential_growth,
            'exponential_decay': self.generate_exponential_decay,
            'logarithmic': self.generate_logarithmic,
            'sine_wave': self.generate_sine_wave,
            'high_frequency_oscillation': self.generate_high_frequency_oscillation,
            'chaotic_oscillation': self.generate_chaotic_oscillation,
            'step_function': self.generate_step_function,
            'spike_pattern': self.generate_spike_pattern,
            'high_variance_random': self.generate_high_variance_random
        }
        
        self.favorable_patterns = {
            'linear_increasing': self.generate_linear_increasing,
            'linear_decreasing': self.generate_linear_decreasing,
            'smooth_polynomial': self.generate_smooth_polynomial,
            'gentle_sine': self.generate_gentle_sine,
            'low_variance_random': self.generate_low_variance_random,
            'constant_value': self.generate_constant_value,
            'gradual_trend': self.generate_gradual_trend
        }
    
    def generate_timestamps(self) -> List[int]:
        """Generate timestamps starting from current time."""
        start_time = int(datetime.now().timestamp() * 1000)
        return [start_time + i * self.timestamp_interval_ms for i in range(self.data_points)]
    
    # Challenging patterns for approximation
    def generate_exponential_growth(self) -> List[float]:
        """Exponential growth: y = e^(x/1000)"""
        x = np.linspace(0, 10, self.data_points)
        return np.exp(x / 1000).tolist()
    
    def generate_exponential_decay(self) -> List[float]:
        """Exponential decay: y = 100 * e^(-x/1000)"""
        x = np.linspace(0, 10, self.data_points)
        return (100 * np.exp(-x / 1000)).tolist()
    
    def generate_logarithmic(self) -> List[float]:
        """Logarithmic pattern: y = log(x+1) * 10"""
        x = np.linspace(1, 1000, self.data_points)
        return (np.log(x) * 10).tolist()
    
    def generate_sine_wave(self) -> List[float]:
        """High amplitude sine wave"""
        x = np.linspace(0, 20 * np.pi, self.data_points)
        return (50 * np.sin(x) + 50).tolist()
    
    def generate_high_frequency_oscillation(self) -> List[float]:
        """High frequency oscillation with varying amplitude"""
        x = np.linspace(0, 100 * np.pi, self.data_points)
        amplitude = np.linspace(10, 100, self.data_points)
        return (amplitude * np.sin(x) + 50).tolist()
    
    def generate_chaotic_oscillation(self) -> List[float]:
        """Multiple overlapping sine waves (chaotic pattern)"""
        x = np.linspace(0, 20 * np.pi, self.data_points)
        y1 = 30 * np.sin(x)
        y2 = 20 * np.sin(3 * x)
        y3 = 10 * np.sin(7 * x)
        return (y1 + y2 + y3 + 50).tolist()
    
    def generate_step_function(self) -> List[float]:
        """Step function with sudden jumps"""
        values = []
        step_size = self.data_points // 10
        for i in range(self.data_points):
            step = i // step_size
            values.append(10 + (step * 15) % 100)
        return values
    
    def generate_spike_pattern(self) -> List[float]:
        """Random spikes in otherwise smooth data"""
        base = np.linspace(10, 50, self.data_points)
        spikes = np.zeros(self.data_points)
        spike_indices = np.random.choice(self.data_points, size=self.data_points//50, replace=False)
        spikes[spike_indices] = np.random.uniform(100, 200, len(spike_indices))
        return (base + spikes).tolist()
    
    def generate_high_variance_random(self) -> List[float]:
        """High variance random walk"""
        values = [50.0]
        for i in range(1, self.data_points):
            change = np.random.normal(0, 10)  # High variance
            new_value = max(0, values[-1] + change)
            values.append(new_value)
        return values
    
    # Favorable patterns for approximation
    def generate_linear_increasing(self) -> List[float]:
        """Simple linear increase"""
        return np.linspace(10, 100, self.data_points).tolist()
    
    def generate_linear_decreasing(self) -> List[float]:
        """Simple linear decrease"""
        return np.linspace(100, 10, self.data_points).tolist()
    
    def generate_smooth_polynomial(self) -> List[float]:
        """Smooth polynomial curve"""
        x = np.linspace(-2, 2, self.data_points)
        return (x**2 * 10 + x * 5 + 50).tolist()
    
    def generate_gentle_sine(self) -> List[float]:
        """Low frequency, low amplitude sine wave"""
        x = np.linspace(0, 4 * np.pi, self.data_points)
        return (5 * np.sin(x) + 50).tolist()
    
    def generate_low_variance_random(self) -> List[float]:
        """Low variance random walk"""
        values = [50.0]
        for i in range(1, self.data_points):
            change = np.random.normal(0, 1)  # Low variance
            new_value = max(0, values[-1] + change)
            values.append(new_value)
        return values
    
    def generate_constant_value(self) -> List[float]:
        """Constant value with minimal noise"""
        base_value = 50.0
        noise = np.random.normal(0, 0.1, self.data_points)
        return (base_value + noise).tolist()
    
    def generate_gradual_trend(self) -> List[float]:
        """Very gradual upward trend"""
        base = np.linspace(45, 55, self.data_points)
        noise = np.random.normal(0, 0.5, self.data_points)
        return (base + noise).tolist()
    
    def write_nt_file(self, values: List[float], timestamps: List[int], filepath: Path, device_type: str = "synthetic", pattern_name: str = ""):
        """Write data in N-Triples format matching the existing data structure"""
        filepath.parent.mkdir(parents=True, exist_ok=True)
        
        # Map device types to proper names
        device_mapping = {
            "smartphone": "smartphoneX",
            "wearable": "wearableX"
        }
        device_name = device_mapping.get(device_type, "smartphoneX")
        
        with open(filepath, 'w') as f:
            for i, (timestamp, value) in enumerate(zip(timestamps, values)):
                # Convert timestamp to ISO format like the original data
                from datetime import datetime
                dt = datetime.fromtimestamp(timestamp / 1000.0)
                iso_timestamp = dt.strftime('%Y-%m-%dT%H:%M:%S.%f')[:-3] + 'Z'
                
                # Generate observation URI
                obs_uri = f"<https://dahcc.idlab.ugent.be/Protego/_participant1/obs{i}>"
                
                # Write all triples on one line like the original format
                f.write(f'{obs_uri} <http://rdfs.org/ns/void#inDataset> <https://dahcc.idlab.ugent.be/Protego/_participant1> . ')
                f.write(f'{obs_uri} <https://saref.etsi.org/core/measurementMadeBy> <https://dahcc.idlab.ugent.be/Homelab/SensorsAndActuators/SM-G950F> . ')
                f.write(f'{obs_uri} <http://purl.org/dc/terms/isVersionOf> <https://saref.etsi.org/core/Measurement> . ')
                f.write(f'{obs_uri} <https://saref.etsi.org/core/relatesToProperty> <https://dahcc.idlab.ugent.be/Homelab/SensorsAndActuators/{device_name}> . ')
                f.write(f'{obs_uri} <https://saref.etsi.org/core/hasTimestamp> "{iso_timestamp}"^^<http://www.w3.org/2001/XMLSchema#dateTime> . ')
                f.write(f'{obs_uri} <https://saref.etsi.org/core/hasValue> "{value:.6f}"^^<http://www.w3.org/2001/XMLSchema#float> .\n')
    
    def generate_window_size_tests(self, pattern_name: str, values: List[float], timestamps: List[int]):
        """Generate datasets with different window sizes for the same pattern"""
        window_sizes = [100, 500, 1000, 2000, 5000]
        
        for window_size in window_sizes:
            if window_size <= len(values):
                windowed_values = values[:window_size]
                windowed_timestamps = timestamps[:window_size]
                
                test_name = f"{pattern_name}_window_{window_size}"
                output_dir = self.base_output_path / "window_tests" / test_name
                output_file = output_dir / f"{test_name}.acceleration.x" / "data.nt"
                
                self.write_nt_file(windowed_values, windowed_timestamps, output_file, "window_test", test_name)
    
    def generate_range_tests(self, pattern_name: str, values: List[float], timestamps: List[int]):
        """Generate datasets with different value ranges for the same pattern"""
        ranges = [
            (0.1, 1.0),    # Very small range
            (1.0, 10.0),   # Small range  
            (10.0, 100.0), # Medium range
            (0.0, 1000.0), # Large range
            (-100.0, 100.0) # Negative to positive range
        ]
        
        for min_val, max_val in ranges:
            # Normalize values to the specified range
            normalized_values = np.array(values)
            current_min, current_max = normalized_values.min(), normalized_values.max()
            if current_max != current_min:
                normalized_values = (normalized_values - current_min) / (current_max - current_min)
                normalized_values = normalized_values * (max_val - min_val) + min_val
            else:
                normalized_values = np.full_like(normalized_values, (min_val + max_val) / 2)
            
            test_name = f"{pattern_name}_range_{min_val}_{max_val}".replace('.', 'p').replace('-', 'neg')
            output_dir = self.base_output_path / "range_tests" / test_name
            output_file = output_dir / f"{test_name}.acceleration.x" / "data.nt"
            
            self.write_nt_file(normalized_values.tolist(), timestamps, output_file, "range_test", test_name)

    def generate_experiment_config(self):
        """Generate configuration file for experiment runner"""
        config = {
            "challenging_patterns": list(self.challenging_patterns.keys()),
            "favorable_patterns": list(self.favorable_patterns.keys()),
            "data_paths": {}
        }
        
        # Add data paths for each pattern
        for pattern_name in self.challenging_patterns.keys():
            config["data_paths"][f"challenging_{pattern_name}"] = f"approximation_test/challenging/{pattern_name}"
        
        for pattern_name in self.favorable_patterns.keys():
            config["data_paths"][f"favorable_{pattern_name}"] = f"approximation_test/favorable/{pattern_name}"
        
        import json
        config_path = self.base_output_path / "experiment_config.json"
        with open(config_path, 'w') as f:
            json.dump(config, f, indent=2)
        
        print(f"Generated experiment configuration: {config_path}")

    def print_directory_structure(self):
        """Print the generated directory structure"""
        print(f"\nGenerated directory structure:")
        print(f"{self.base_output_path}/")
        print("├── challenging/")
        for pattern in self.challenging_patterns.keys():
            print(f"│   ├── {pattern}/{pattern}.acceleration.x/data.nt")
        print("├── favorable/")
        for pattern in self.favorable_patterns.keys():
            print(f"│   ├── {pattern}/{pattern}.acceleration.x/data.nt")
        print("├── window_tests/")
        print("│   ├── [pattern]_window_[size]/[pattern]_window_[size].acceleration.x/data.nt")
        print("└── range_tests/")
        print("    └── [pattern]_range_[min]_[max]/[pattern]_range_[min]_[max].acceleration.x/data.nt")
    
    def generate_accuracy_comparison_script(self):
        """Generate a script to run accuracy comparisons"""
        script_content = '''#!/bin/bash
# Accuracy comparison script for approximation approach

echo "Running accuracy comparison tests..."

# Test challenging patterns
echo "Testing challenging patterns:"
for pattern in exponential_growth exponential_decay logarithmic sine_wave high_frequency_oscillation chaotic_oscillation step_function spike_pattern high_variance_random; do
    echo "Testing pattern: $pattern"
    # Run your approximation approach here
    # Run your exact computation here
    # Compare results
done

# Test favorable patterns  
echo "Testing favorable patterns:"
for pattern in linear_increasing linear_decreasing smooth_polynomial gentle_sine low_variance_random constant_value gradual_trend; do
    echo "Testing pattern: $pattern"
    # Run your approximation approach here
    # Run your exact computation here
    # Compare results
done

echo "Accuracy comparison complete!"
'''
        
        script_path = self.base_output_path / "run_accuracy_tests.sh"
        with open(script_path, 'w') as f:
            f.write(script_content)
        os.chmod(script_path, 0o755)
        print(f"Generated accuracy comparison script: {script_path}")
    
    def generate_all_datasets(self):
        """Generate all test datasets"""
        print("Generating approximation test datasets...")
        
        # Create base directory
        self.base_output_path.mkdir(parents=True, exist_ok=True)
        
        # Generate challenging patterns
        print("Generating challenging patterns...")
        challenging_dir = self.base_output_path / "challenging"
        challenging_dir.mkdir(exist_ok=True)
        
        for pattern_name, pattern_func in self.challenging_patterns.items():
            print(f"  Generating {pattern_name}...")
            values = pattern_func()
            timestamps = self.generate_timestamps()
            
            # Create smartphone data
            output_dir = challenging_dir / pattern_name
            smartphone_file = output_dir / "smartphone.acceleration.x" / "data.nt"
            self.write_nt_file(values, timestamps, smartphone_file, "smartphone", pattern_name)
            
            # Create wearable data (with slight variation for realism)
            wearable_values = [v + np.random.normal(0, abs(v) * 0.02) for v in values]  # Add 2% noise
            wearable_file = output_dir / "wearable.acceleration.x" / "data.nt"
            self.write_nt_file(wearable_values, timestamps, wearable_file, "wearable", pattern_name)
            
        # Generate favorable patterns
        print("Generating favorable patterns...")
        favorable_dir = self.base_output_path / "favorable"
        favorable_dir.mkdir(exist_ok=True)
        
        for pattern_name, pattern_func in self.favorable_patterns.items():
            print(f"  Generating {pattern_name}...")
            values = pattern_func()
            timestamps = self.generate_timestamps()
            
            # Create smartphone data
            output_dir = favorable_dir / pattern_name
            smartphone_file = output_dir / "smartphone.acceleration.x" / "data.nt"
            self.write_nt_file(values, timestamps, smartphone_file, "smartphone", pattern_name)
            
            # Create wearable data (with slight variation for realism)
            wearable_values = [v + np.random.normal(0, abs(v) * 0.02) for v in values]  # Add 2% noise
            wearable_file = output_dir / "wearable.acceleration.x" / "data.nt"
            self.write_nt_file(wearable_values, timestamps, wearable_file, "wearable", pattern_name)
        
        # Generate experiment configuration
        self.generate_experiment_config()
        
        print("Dataset generation complete!")
        self.print_directory_structure()


def main():
    parser = argparse.ArgumentParser(description="Generate synthetic datasets for approximation accuracy testing")
    parser.add_argument("--output-path", 
                       default="/Users/kushbisen/Code/streaming-query-hive/src/streamer/data/approximation_test",
                       help="Output path for generated datasets")
    parser.add_argument("--data-points", type=int, default=10000,
                       help="Number of data points per dataset")
    parser.add_argument("--interval-ms", type=int, default=100,
                       help="Interval between timestamps in milliseconds")
    
    args = parser.parse_args()
    
    generator = ApproximationTestDataGenerator(args.output_path)
    generator.data_points = args.data_points
    generator.timestamp_interval_ms = args.interval_ms
    
    generator.generate_all_datasets()
    generator.generate_accuracy_comparison_script()


if __name__ == "__main__":
    main()
