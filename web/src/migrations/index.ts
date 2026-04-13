import * as migration_20260220_083757 from './20260220_083757';
import * as migration_20260224_114500 from './20260224_114500';
import * as migration_20260303_114458 from './20260303_114458';

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
];
