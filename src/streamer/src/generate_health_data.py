import sys
import numpy as np
import pytz
from data_sink import KafkaProducerSink, CassandraSink, DataSink
import datetime

DATA_PROPERTIES = {
    'org.dyamand.types.health.GlucoseLevel': {
        'sensors': ['60:77:71:7D:93:D7/service0009', 'B0:91:22:FB:D0:78/service0009'],
        'mean_values_per_mode': {'normal': 95, 'abnormal': 55},
        'noise': 3,
        'timestamps': ['08:10:00.000000']
    },
    'org.dyamand.types.health.DiastolicBloodPressure': {
        'sensors': ['00:9D:6B:89:43:CD/service0025', '00:9D:6B:8B:FD:65/service0025'],
        'mean_values_per_mode': {'normal': 80, 'abnormal': 60},
        'noise': 1.5,
        'timestamps': ['08:12:00.000000']
    },
    'org.dyamand.types.health.SystolicBloodPressure': {
        'sensors': ['00:9D:6B:89:43:CD/service0025', '00:9D:6B:8B:FD:65/service0025'],
        'mean_values_per_mode': {'normal': 130, 'abnormal': 88},
        'noise': 1.5,
        'timestamps': ['08:12:00.000000']
    },
    'org.dyamand.types.health.SpO2': {
        'sensors': ['00:1C:05:FF:A9:4E/service0029', '00:1C:05:FE:44:6B/service0029'],
        'mean_values_per_mode': {'normal': 97, 'abnormal': 88},
        'noise': 0.2,
        'timestamps': ['08:13:00.000000']
    },
    'org.dyamand.types.health.BodyTemperature': {
        'sensors': ['F8:33:31:46:7F.D0/service0010', 'F8:33:31:46:6E:0B/service0010'],
        'mean_values_per_mode': {'normal': 36, 'abnormal': 38},
        'noise': 0.1,
        'timestamps': ['08:14:00.000000']
    },
    'org.dyamand.types.common.Load': {
        'sensors': ['2C:AB:33:21:75:AD/service0010'],
        'mean_values_per_mode': {'normal': 65, 'abnormal': [65.5, 66.5, 67.5, 68.5]},
        'noise': 0.1,
        'timestamps': ['08:15:00.000000']
    }
}


def convert_df_timestamp(timestamp, date):
    if type(timestamp) == datetime.time:
        converted_timestamp = timestamp
    else:
        try:
            converted_timestamp = datetime.datetime.strptime(timestamp, '%H:%M:%S.%f').time()
        except ValueError:
            converted_timestamp = datetime.datetime.strptime(timestamp, '%H:%M:%S').time()
    return pytz.timezone('Europe/Brussels').localize(datetime.datetime.combine(date, converted_timestamp))


class ReplayConfig:
    def __init__(self, properties: list, days: list, timestamps: list = None):
        self.properties = properties
        self.days = days
        self.timestamps = timestamps


class ReplayConfigNow(ReplayConfig):
    def __init__(self, properties: list, mode: str):
        # generate day & timestamp string for current time
        now = pytz.timezone('Europe/Brussels').localize(datetime.datetime.now())
        days = [(now.strftime('%Y-%m-%d'), mode)]
        timestamps = [now.strftime('%H:%M:%S')]

        # populate fields of replay config
        super().__init__(properties=properties, days=days, timestamps=timestamps)


class HealthDataGenerator:
    def __init__(self, sink: DataSink, patient_id: str):
        self.sink = sink
        self.sink.set_patient_id(patient_id=patient_id)

    def generate_data(self, replay_config: ReplayConfig):
        for _property in replay_config.properties:
            for day, mode in replay_config.days:
                mode_split = mode.split('_')
                mode = mode_split[0]

                if mode not in DATA_PROPERTIES[_property]['mean_values_per_mode']:
                    print('Unknown mode')
                    sys.exit(1)
                mean = DATA_PROPERTIES[_property]['mean_values_per_mode'][mode]
                if type(mean) == list:
                    mean = mean[int(mode_split[1]) - 1]

                value = np.random.normal(mean, DATA_PROPERTIES[_property]['noise'])
                timestamps_used = replay_config.timestamps if replay_config.timestamps is not None \
                    else DATA_PROPERTIES[_property]['timestamps']
                add_noise_to_timestamps = replay_config.timestamps is None
                for ts in timestamps_used:
                    for sensor in DATA_PROPERTIES[_property]['sensors']:
                        ts_noise = np.random.randint(low=-60, high=60) if add_noise_to_timestamps else 0
                        data_point = {
                            'metricId': _property,
                            'sourceId': sensor,
                            'timestamp': int(
                                (convert_df_timestamp(ts, datetime.datetime.strptime(day, '%Y-%m-%d').date())
                                 .timestamp() + ts_noise) * 1000),
                            'value': value
                        }
                        self.sink.add_homelab_data_to_batch(data_point)
                        print(day, data_point)

        # actually send data to sink
        self.sink.send_data_batch()


class KafkaHealthDataGenerator(HealthDataGenerator):
    def __init__(self, patient_id: str, local: bool = False):
        sink = KafkaProducerSink('external.events', local=local)
        super().__init__(sink, patient_id)


class CassandraHealthDataGenerator(HealthDataGenerator):
    def __init__(self, patient_id: str):
        sink = CassandraSink()
        super().__init__(sink, patient_id)


def load_scenario_1() -> (str, list[ReplayConfig]):
    patient_id = '9'

    replay_configs = [
        ReplayConfig(
            properties=['org.dyamand.types.health.GlucoseLevel',
                        'org.dyamand.types.common.Load'],
            days=[
                ('2022-12-07', 'normal'),
                ('2022-12-08', 'normal'),
                ('2022-12-09', 'normal'),
                ('2022-12-10', 'normal'),
                ('2022-12-11', 'normal'),
                ('2022-12-12', 'normal'),
                ('2022-12-13', 'normal'),
                ('2022-12-14', 'normal')
            ]
        )
    ]
    return patient_id, replay_configs


def load_scenario_2() -> (str, list[ReplayConfig]):
    patient_id = '10'

    replay_configs = [
        ReplayConfig(
            properties=['org.dyamand.types.health.DiastolicBloodPressure',
                        'org.dyamand.types.health.SystolicBloodPressure',
                        'org.dyamand.types.health.SpO2',
                        'org.dyamand.types.common.Load'],
            days=[
                ('2022-12-07', 'normal'),
                ('2022-12-08', 'normal'),
                ('2022-12-09', 'normal'),
                ('2022-12-10', 'normal'),
                ('2022-12-11', 'normal'),
                ('2022-12-12', 'normal'),
                ('2022-12-13', 'normal'),
                ('2022-12-14', 'normal')
            ]
        ),
        ReplayConfig(
            properties=['org.dyamand.types.health.DiastolicBloodPressure',
                        'org.dyamand.types.health.SystolicBloodPressure'],
            days=[
                ('2022-12-14', 'abnormal')
            ],
            timestamps=['13:49:31.000000']
        ),
        ReplayConfig(
            properties=['org.dyamand.types.health.SpO2'],
            days=[
                ('2022-12-14', 'abnormal')
            ],
            timestamps=['13:51:48.000000']
        )
    ]

    return patient_id, replay_configs


def load_scenario_3() -> (str, list[ReplayConfig]):
    patient_id = '11'

    replay_configs = [
        ReplayConfig(
            properties=['org.dyamand.types.health.DiastolicBloodPressure',
                        'org.dyamand.types.health.SystolicBloodPressure',
                        'org.dyamand.types.health.SpO2',
                        'org.dyamand.types.common.Load'],
            days=[
                ('2022-12-07', 'normal'),
                ('2022-12-08', 'normal'),
                ('2022-12-09', 'normal'),
                ('2022-12-10', 'normal'),
                ('2022-12-11', 'normal'),
                ('2022-12-12', 'normal'),
                ('2022-12-13', 'normal'),
                ('2022-12-14', 'normal')
            ]
        )
    ]

    return patient_id, replay_configs


def load_scenario_4() -> (str, list[ReplayConfig]):
    patient_id = '12'

    replay_configs = [
        ReplayConfig(
            properties=['org.dyamand.types.health.DiastolicBloodPressure',
                        'org.dyamand.types.health.SystolicBloodPressure',
                        'org.dyamand.types.health.SpO2'],
            days=[
                ('2022-12-07', 'normal'),
                ('2022-12-08', 'normal'),
                ('2022-12-09', 'normal'),
                ('2022-12-10', 'normal'),
                ('2022-12-11', 'normal'),
                ('2022-12-12', 'normal'),
                ('2022-12-13', 'normal'),
                ('2022-12-14', 'normal')
            ]
        ),
        ReplayConfig(
            properties=['org.dyamand.types.common.Load'],
            days=[
                ('2022-12-07', 'normal'),
                ('2022-12-08', 'normal'),
                ('2022-12-09', 'normal'),
                ('2022-12-10', 'normal'),
                ('2022-12-11', 'normal'),
                ('2022-12-12', 'abnormal_1'),
                ('2022-12-13', 'abnormal_2'),
                ('2022-12-14', 'abnormal_3')
            ]
        )
    ]

    return patient_id, replay_configs


if __name__ == '__main__':
    # load scenario data
    _patient_id, _replay_configs = load_scenario_4()

    # generate data
    for _replay_config in _replay_configs:
        CassandraHealthDataGenerator(patient_id=_patient_id).generate_data(replay_config=_replay_config)
        print()
