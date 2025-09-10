# Streaming Configuration for Noisy Datasets
# Generated automatically

NOISE_DATASETS = {
    0.1: {
        "wearable": "/Users/kushbisen/Code/streaming-query-hive/src/streamer/data/noisy_datasets/noise_0.1/wearable.acceleration.x/data.nt",
        "smartphone": "/Users/kushbisen/Code/streaming-query-hive/src/streamer/data/noisy_datasets/noise_0.1/smartphone.acceleration.x/data.nt"
    },
    0.2: {
        "wearable": "/Users/kushbisen/Code/streaming-query-hive/src/streamer/data/noisy_datasets/noise_0.2/wearable.acceleration.x/data.nt",
        "smartphone": "/Users/kushbisen/Code/streaming-query-hive/src/streamer/data/noisy_datasets/noise_0.2/smartphone.acceleration.x/data.nt"
    },
    0.5: {
        "wearable": "/Users/kushbisen/Code/streaming-query-hive/src/streamer/data/noisy_datasets/noise_0.5/wearable.acceleration.x/data.nt",
        "smartphone": "/Users/kushbisen/Code/streaming-query-hive/src/streamer/data/noisy_datasets/noise_0.5/smartphone.acceleration.x/data.nt"
    },
    1.0: {
        "wearable": "/Users/kushbisen/Code/streaming-query-hive/src/streamer/data/noisy_datasets/noise_1.0/wearable.acceleration.x/data.nt",
        "smartphone": "/Users/kushbisen/Code/streaming-query-hive/src/streamer/data/noisy_datasets/noise_1.0/smartphone.acceleration.x/data.nt"
    },
    2.0: {
        "wearable": "/Users/kushbisen/Code/streaming-query-hive/src/streamer/data/noisy_datasets/noise_2.0/wearable.acceleration.x/data.nt",
        "smartphone": "/Users/kushbisen/Code/streaming-query-hive/src/streamer/data/noisy_datasets/noise_2.0/smartphone.acceleration.x/data.nt"
    },

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
