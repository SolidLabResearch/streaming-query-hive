#!/usr/bin/env python3

import re
import os
import random
import math
from typing import List, Dict, Tuple, Optional
import argparse
from pathlib import Path

class SimpleAccelerationNoiseGenerator:
    """
    Generate multiple datasets with varying noise levels for acceleration data.
    Uses only standard library - no numpy dependency.
    """
    
    def __init__(self, base_data_path: str = "/Users/kushbisen/Code/streaming-query-hive/src/streamer/data"):
        self.base_data_path = Path(base_data_path)
        self.noise_levels = [0.1, 0.5, 1.0, 2.0, 5.0]  # Different noise standard deviations
        self.data_sources = [
            'wearable.acceleration.x',
            'smartphone.acceleration.x'
        ]
    
    def gaussian_noise(self, mean: float = 0.0, std_dev: float = 1.0) -> float:
        """
        Generate Gaussian noise using Box-Muller transform.
        """
        # Box-Muller transform to generate Gaussian noise
        u1 = random.random()
        u2 = random.random()
        z0 = math.sqrt(-2 * math.log(u1)) * math.cos(2 * math.pi * u2)
        return mean + std_dev * z0
    
    def parse_nt_line(self, line: str) -> Tuple[str, Optional[float]]:
        """
        Parse an N-Triples line and extract the hasValue float.
        Returns: (full_line_without_value, original_value)
        """
        # Pattern to match hasValue with float value
        pattern = r'(<https://saref\.etsi\.org/core/hasValue>)\s+"([^"]+)"\^\^<http://www\.w3\.org/2001/XMLSchema#float>'
        
        import re
        match = re.search(pattern, line)
        
        if match:
            try:
                original_value = float(match.group(2))
                # Replace the value with a placeholder to reconstruct later
                line_without_value = re.sub(pattern, r'\1 "PLACEHOLDER"^^<http://www.w3.org/2001/XMLSchema#float>', line)
                return line_without_value, original_value
            except ValueError:
                return line, None
        else:
            return line, None
    
    def add_noise_to_value(self, original_value: float, noise_level: float) -> float:
        """
        Add Gaussian noise to the original value.
        """
        noise = self.gaussian_noise(0.0, noise_level)
        return original_value + noise
    
    def generate_noisy_dataset(self, source_file: Path, noise_level: float, output_file: Path) -> int:
        """
        Generate a noisy version of the dataset.
        Returns: number of values modified
        """
        modified_count = 0
        
        # Create output directory if it doesn't exist
        output_file.parent.mkdir(parents=True, exist_ok=True)
        
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
                    # Calculate statistics without numpy
                    count = len(values)
                    mean = sum(values) / count
                    variance = sum((x - mean) ** 2 for x in values) / count
                    std_dev = math.sqrt(variance)
                    min_val = min(values)
                    max_val = max(values)
                    
                    print(f"\\n{source}:")
                    print(f"  Count: {count}")
                    print(f"  Mean: {mean:.6f}")
                    print(f"  Std Dev: {std_dev:.6f}")
                    print(f"  Min: {min_val:.6f}")
                    print(f"  Max: {max_val:.6f}")
                    print(f"  Range: {max_val - min_val:.6f}")
                    print(f"  Suggested noise levels based on std dev:")
                    print(f"    Low (5%):   {std_dev * 0.05:.3f}")
                    print(f"    Medium (10%): {std_dev * 0.10:.3f}")
                    print(f"    High (25%):   {std_dev * 0.25:.3f}")
            else:
                print(f"  WARNING: Source file not found: {source_file}")


def create_streaming_config(noise_levels: List[float], base_path: str) -> str:
    """
    Create a configuration file for streaming with different noise levels.
    """
    config_content = f'''# Streaming Configuration for Noisy Datasets
# Generated automatically

NOISE_DATASETS = {{
'''
    
    for noise_level in noise_levels:
        config_content += f'''    {noise_level}: {{
        "wearable": "{base_path}/noise_{noise_level}/wearable.acceleration.x/data.nt",
        "smartphone": "{base_path}/noise_{noise_level}/smartphone.acceleration.x/data.nt"
    }},
'''
    
    config_content += '''
}

def get_dataset_path(noise_level: float, device_type: str) -> str:
    """Get the path to a specific noisy dataset."""
    if noise_level in NOISE_DATASETS and device_type in NOISE_DATASETS[noise_level]:
        return NOISE_DATASETS[noise_level][device_type]
    else:
        raise ValueError(f"Dataset not found for noise_level={noise_level}, device_type={device_type}")

def get_available_noise_levels() -> list:
    """Get list of available noise levels."""
    return list(NOISE_DATASETS.keys())
'''
    
    return config_content


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
    parser.add_argument("--create-config", action="store_true",
                       help="Create streaming configuration file")
    
    args = parser.parse_args()
    
    generator = SimpleAccelerationNoiseGenerator(args.data_path)
    
    if args.analyze:
        generator.analyze_original_data()
        return
    
    # Determine output path
    if args.output_path:
        output_path = Path(args.output_path)
    else:
        output_path = Path(args.data_path) / "noisy_datasets"
    
    # Determine noise levels
    noise_levels = args.noise_levels or generator.noise_levels
    
    # Generate datasets
    if args.noise_levels:
        generator.generate_custom_noise_levels(args.noise_levels, str(output_path))
    else:
        generator.generate_all_datasets(str(output_path))
    
    # Create config file if requested
    if args.create_config:
        config_content = create_streaming_config(noise_levels, str(output_path))
        config_file = output_path / "streaming_config.py"
        with open(config_file, 'w') as f:
            f.write(config_content)
        print(f"\\n Created streaming config: {config_file}")
    
    print(f"{output_path}/")
    for noise_level in noise_levels:
        print(f"├── noise_{noise_level}/")
        print(f"│   ├── wearable.acceleration.x/data.nt")
        print(f"│   └── smartphone.acceleration.x/data.nt")
    
    print(f"\\Usage examples:")
    print(f"# Analyze original data:")
    print(f"python {__file__} --analyze")
    print(f"\\n# Generate with custom noise levels:")
    print(f"python {__file__} --noise-levels 0.2 1.5 3.0")
    print(f"\\n# Create streaming config:")
    print(f"python {__file__} --create-config")


if __name__ == "__main__":
    main()
