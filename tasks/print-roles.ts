import { task, types } from 'hardhat/config';
import { BatchTimelock__factory } from '../typechain';

task('roles:print', 'Prints bytes32 values of roles')
  .setAction(async (_, hre) => {
    const TERMINATION_ADMIN_ROLE = hre.ethers.id("TERMINATION_ADMIN");
    console.log("TERMINATION_ADMIN_ROLE (via id):", TERMINATION_ADMIN_ROLE);
    const TIMELOCK_CREATOR_ROLE = hre.ethers.id("TIMELOCK_CREATOR_ROLE");
    console.log("TIMELOCK_CREATOR_ROLE (via id):", TIMELOCK_CREATOR_ROLE);
    const STAKING_MANAGER = hre.ethers.id("STAKING_MANAGER");
    console.log("STAKING_MANAGER (via id):", STAKING_MANAGER);
  });