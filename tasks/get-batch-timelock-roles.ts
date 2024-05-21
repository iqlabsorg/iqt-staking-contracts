import { task, types } from 'hardhat/config';
import { id } from 'ethers';

export const solidityIdBytes32 = (string: string): string => {
  return id(string);
};

const TERMINATION_ADMIN_ROLE = solidityIdBytes32('TERMINATION_ADMIN');
const TIMELOCK_CREATOR_ROLE = solidityIdBytes32('TIMELOCK_CREATOR');

task('roles:batch-timelock', 'Deploy and setup the whole Staking structure').setAction(async ({}, hre) => {
  console.log('TERMINATION ADMIN ROLE: ', TERMINATION_ADMIN_ROLE);
  console.log('TIMELOCK CREATOR ROLE: ', TIMELOCK_CREATOR_ROLE);
});
