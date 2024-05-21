import { task, types } from 'hardhat/config';
import { id } from 'ethers';

export const solidityIdBytes32 = (string: string): string => {
  return id(string);
};

const STAKING_MANAGER_ROLE = solidityIdBytes32('STAKING_MANAGER');

task('roles:staking-manager', 'Deploy and setup the whole Staking structure').setAction(async ({}, hre) => {
  console.log('STAKING MANAGER ROLE: ', STAKING_MANAGER_ROLE);
});
