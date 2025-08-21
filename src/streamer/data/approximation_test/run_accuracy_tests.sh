#!/bin/bash
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
