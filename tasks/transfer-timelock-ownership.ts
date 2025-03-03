import { task, types } from 'hardhat/config';
import { BatchTimelock__factory } from '../typechain';
import { ZeroHash } from 'ethers';

task('timelock:transfer-ownership', 'Adds a batch of timelocks from a CSV file')
  .addParam('batchTimelock', 'The BatchTimelock contract address', undefined, types.string, false)
  .addParam('newOwner', 'The new owner address', undefined, types.string, false)
  .setAction(async ({ batchTimelock, newOwner }, hre) => {
    const DEFAULT_ADMIN = ZeroHash;
    const TERMINATION_ADMIN_ROLE = hre.ethers.id('TERMINATION_ADMIN');
    const TIMELOCK_CREATOR_ROLE = hre.ethers.id('TIMELOCK_CREATOR');

    if (!batchTimelock) throw new Error('You must specify a BatchTimelock contract address');
    if (!newOwner) throw new Error('You must specify a new owner address');

    const [deployer] = await hre.ethers.getSigners();

    const batchTimelockContract = BatchTimelock__factory.connect(batchTimelock, deployer);

    const hasTimelockCreatorRole = await batchTimelockContract.hasRole(TIMELOCK_CREATOR_ROLE, deployer.address);

    if (!hasTimelockCreatorRole) {
      throw new Error('You must have the TIMELOCK_CREATOR role to transfer the ownership');
    }

    const hasTerminationAdminRole = await batchTimelockContract.hasRole(TERMINATION_ADMIN_ROLE, deployer.address);
    if (!hasTerminationAdminRole) {
      throw new Error('You must have the TERMINATION_ADMIN role to transfer the ownership');
    }

    const hasAdminRole = await batchTimelockContract.hasRole(DEFAULT_ADMIN, deployer.address);
    if (!hasAdminRole) {
      throw new Error('You must have the DEFAULT_ADMIN role to transfer the ownership');
    }

    console.log('------------------------------------------------------');
    console.log('Granting roles...');
    console.log('------------------------------------------------------');

    console.log(`Granting DEFAULT_ADMIN role to ${newOwner}...`);
    const grantAdminTx = await batchTimelockContract.grantRole(DEFAULT_ADMIN, newOwner);
    await grantAdminTx.wait();
    console.log(`TX: ${grantAdminTx.hash}`);
    console.log(`DEFAULT_ADMIN role granted to ${newOwner}`);

    console.log(`Granting TIMELOCK_CREATOR role to ${newOwner}...`);
    const grantTimelockCreatorTx = await batchTimelockContract.grantRole(TIMELOCK_CREATOR_ROLE, newOwner);
    await grantTimelockCreatorTx.wait();
    console.log(`TX: ${grantTimelockCreatorTx.hash}`);
    console.log(`TIMELOCK_CREATOR role granted to ${newOwner}`);

    console.log(`Granting TERMINATION_ADMIN role to ${newOwner}...`);
    const grantTerminationAdminTx = await batchTimelockContract.grantRole(TERMINATION_ADMIN_ROLE, newOwner)
    await grantTerminationAdminTx.wait();
    console.log(`TX: ${grantTerminationAdminTx.hash}`);
    console.log(`TERMINATION_ADMIN role granted to ${newOwner}`);

    console.log('------------------------------------------------------');
    console.log('All roles granted.');
    console.log('------------------------------------------------------');
    console.log('Renouncing roles...');
    console.log('------------------------------------------------------');

    console.log('Renouncing TIMELOCK_CREATOR role...');
    const renounceTimelockCreatorTx = await batchTimelockContract.renounceRole(TIMELOCK_CREATOR_ROLE, deployer.address);
    await renounceTimelockCreatorTx.wait();
    console.log(`TX: ${renounceTimelockCreatorTx.hash}`);
    console.log('TIMELOCK_CREATOR role renounced');

    console.log('Renouncing TERMINATION_ADMIN role...');
    const renounceTerminationAdminTx = await batchTimelockContract.renounceRole(TERMINATION_ADMIN_ROLE, deployer.address);
    await renounceTerminationAdminTx.wait();
    console.log(`TX: ${renounceTerminationAdminTx.hash}`);
    console.log('TERMINATION_ADMIN role renounced');

    console.log('Renouncing DEFAULT_ADMIN role...');
    const renounceAdminTx = await batchTimelockContract.renounceRole(DEFAULT_ADMIN, deployer.address);
    await renounceAdminTx.wait();
    console.log(`TX: ${renounceAdminTx.hash}`);
    console.log('DEFAULT_ADMIN role renounced');

    console.log('------------------------------------------------------');
    console.log('All roles renounced.');
    console.log('------------------------------------------------------');
  });