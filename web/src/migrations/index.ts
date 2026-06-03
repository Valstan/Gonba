import * as migration_20260220_083757 from './20260220_083757';
import * as migration_20260224_114500 from './20260224_114500';
import * as migration_20260303_114458 from './20260303_114458';
import * as migration_20260521_120000 from './20260521_120000';
import * as migration_20260525_080000 from './20260525_080000';
import * as migration_20260601_120000 from './20260601_120000';
import * as migration_20260602_120000 from './20260602_120000';
import * as migration_20260603_120000 from './20260603_120000';

export const migrations = [
  {
    up: migration_20260220_083757.up,
    down: migration_20260220_083757.down,
    name: '20260220_083757',
  },
  {
    up: migration_20260224_114500.up,
    down: migration_20260224_114500.down,
    name: '20260224_114500',
  },
  {
    up: migration_20260303_114458.up,
    down: migration_20260303_114458.down,
    name: '20260303_114458'
  },
  {
    up: migration_20260521_120000.up,
    down: migration_20260521_120000.down,
    name: '20260521_120000',
  },
  {
    up: migration_20260525_080000.up,
    down: migration_20260525_080000.down,
    name: '20260525_080000',
  },
  {
    up: migration_20260601_120000.up,
    down: migration_20260601_120000.down,
    name: '20260601_120000',
  },
  {
    up: migration_20260602_120000.up,
    down: migration_20260602_120000.down,
    name: '20260602_120000',
  },
  {
    up: migration_20260603_120000.up,
    down: migration_20260603_120000.down,
    name: '20260603_120000',
  },
];
