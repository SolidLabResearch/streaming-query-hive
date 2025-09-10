#!/usr/bin/env python3

import re
import os
import numpy as np
from typing import List, Dict, Tuple
import argparse
from pathlib import Path

class AccelerationDataNoiseGenerator:
    """
    Generate multiple datasets with varying noise levels for acceleration data stored in N-Triples format.
    """
    
    def __init__(self, base_data_path: str = "/Users/kushbisen/Code/streaming-query-hive/src/streamer/data"):
        self.base_data_path = Path(base_data_path)
        self.noise_levels = [0.1, 0.5, 1.0, 2.0, 5.0]  # Different noise standard deviations
        self.data_sources = [
            'wearable.acceleration.x',
            'smartphone.acceleration.x'
        ]
    
    def parse_nt_line(self, line: str) -> Tuple[str, float]:
        """
        Parse an N-Triples line and extract the hasValue float.
        Returns: (full_line_without_value, original_value)
        """
        # Pattern to match hasValue with float value
        pattern = r'(<https://saref\.etsi\.org/core/hasValue>)\s+"([^"]+)"\^\^<http://www\.w3\.org/2001/XMLSchema#float>'
        match = re.search(pattern, line)
        
        if match:
            original_value = float(match.group(2))
            # Replace the value with a placeholder to reconstruct later
            line_without_value = re.sub(pattern, r'\1 "PLACEHOLDER"^^<http://www.w3.org/2001/XMLSchema#float>', line)
            return line_without_value, original_value
        else:
            return line, None
    
    def add_noise_to_value(self, original_value: float, noise_level: float) -> float:
        """
        Add Gaussian noise to the original value.
        """
        noise = np.random.normal(0, noise_level)
        return original_value + noise
    
    def generate_noisy_dataset(self, source_file: Path, noise_level: float, output_file: Path) -> int:
        """
        Generate a noisy version of the dataset.
        Returns: number of values modified
        """
        modified_count = 0
        
        with open(source_file, 'r') as input_f, open(output_file, 'w') as output_f:
            for line in input_f:
                line = line.strip()
                if line:
                    line_template, original_value = self.parse_nt_line(line)
                    
                    if original_value is not None:
                        # Add noise to the value
                        noisy_value = self.add_noise_to_value(original_value, noise_level)
                        # Replace placeholder with noisy value
                        new_line = line_template.replace('PLACEHOLDER', f'{noisy_value:.6f}')
                        output_f.write(new_line + '\n')
                        modified_count += 1
                    else:
                        output_f.write(line + '\n')
        
        return modified_count
    
    def create_directory_structure(self, base_output_path: Path):
        """
        Create directory structure for different noise levels.
        """
        for noise_level in self.noise_levels:
            for source in self.data_sources:
                output_dir = base_output_path / f"noise_{noise_level}" / source
                output_dir.mkdir(parents=True, exist_ok=True)
    
    def generate_all_datasets(self, output_base_path: str = None):
        """
        Generate all datasets with different noise levels.
        """
        if output_base_path is None:
            output_base_path = self.base_data_path / "noisy_datasets"
        else:
            output_base_path = Path(output_base_path)
        
        print(f"Creating noisy datasets in: {output_base_path}")
        
        # Create directory structure
        self.create_directory_structure(output_base_path)
        
        # Generate datasets for each noise level and data source
        for noise_level in self.noise_levels:
            print(f"\\nGenerating datasets with noise level: {noise_level}")
            
            for source in self.data_sources:
                source_file = self.base_data_path / source / "data.nt"
                output_file = output_base_path / f"noise_{noise_level}" / source / "data.nt"
                
                if source_file.exists():
                    modified_count = self.generate_noisy_dataset(source_file, noise_level, output_file)
                    print(f"  {source}: {modified_count} values modified -> {output_file}")
                else:
                    print(f"  WARNING: Source file not found: {source_file}")
    
    def generate_custom_noise_levels(self, custom_noise_levels: List[float], output_base_path: str = None):
        """
        Generate datasets with custom noise levels.
        """
        original_noise_levels = self.noise_levels
        self.noise_levels = custom_noise_levels
        self.generate_all_datasets(output_base_path)
        self.noise_levels = original_noise_levels
    
    def analyze_original_data(self):
        """
        Analyze the original data to help determine appropriate noise levels.
        """
        print("Analyzing original data...")
        
        for source in self.data_sources:
            source_file = self.base_data_path / source / "data.nt"
            if source_file.exists():
                values = []
                
                with open(source_file, 'r') as f:
                    for line in f:
                        _, value = self.parse_nt_line(line.strip())
                        if value is not None:
                            values.append(value)
                
                if values:
                    values = np.array(values)
                    print(f"\\n{source}:")
                    print(f"  Count: {len(values)}")
                    print(f"  Mean: {np.mean(values):.6f}")
                    print(f"  Std Dev: {np.std(values):.6f}")
                    print(f"  Min: {np.min(values):.6f}")
                    print(f"  Max: {np.max(values):.6f}")
                    print(f"  Range: {np.max(values) - np.min(values):.6f}")
            else:
                print(f"  WARNING: Source file not found: {source_file}")


def main():
    parser = argparse.ArgumentParser(description="Generate noisy versions of acceleration datasets")
    parser.add_argument("--data-path", default="/Users/kushbisen/Code/streaming-query-hive/src/streamer/data",
                       help="Path to the base data directory")
    parser.add_argument("--output-path", default=None,
                       help="Path for output datasets (default: <data-path>/noisy_datasets)")
    parser.add_argument("--noise-levels", nargs='+', type=float, default=None,
                       help="Custom noise levels (default: 0.1 0.5 1.0 2.0 5.0)")
    parser.add_argument("--analyze", action="store_true",
                       help="Analyze original data statistics")
    
    args = parser.parse_args()
    
    generator = AccelerationDataNoiseGenerator(args.data_path)
    
    if args.analyze:
        generator.analyze_original_data()
        return
    
    if args.noise_levels:
        generator.generate_custom_noise_levels(args.noise_levels, args.output_path)
    else:
        generator.generate_all_datasets(args.output_path)
        
    if args.output_path:
        output_path = Path(args.output_path)
    else:
        output_path = Path(args.data_path) / "noisy_datasets"
    
    print(f"{output_path}/")
    for noise_level in (args.noise_levels or generator.noise_levels):
        print(f"├── noise_{noise_level}/")
        print(f"│   ├── wearable.acceleration.x/data.nt")
        print(f"│   └── smartphone.acceleration.x/data.nt")


if __name__ == "__main__":
    main()
