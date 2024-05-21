import { task, types } from 'hardhat/config';
import { Staking__factory } from '../typechain';
import { ethers } from 'hardhat';

task('deploy:staking', 'Deploy the Staking contract')
  .addParam('stakingManagement', 'StakingManagement Contract Address', undefined, types.string, false)
  .addParam('stakingPool', 'Address of staking pool', undefined, types.string, false)
  .addParam('rewardPoolSize', 'Reward pool size', undefined, types.string, false)
  .setAction(async ({ stakingManagement, stakingPool, rewardPoolSize }, hre) => {
    const [deployer] = await hre.ethers.getSigners();

    if (!stakingManagement) {
      throw new Error('Staking Management is required');
    }

    if (!stakingPool) {
      throw new Error('Staking Pool is required');
    }

    if (!rewardPoolSize) {
      throw new Error('Reward Pool Size is required');
    }

    console.log('Deploying...', { stakingManagement, stakingPool, rewardPoolSize });

    await hre.deployments.delete('Staking');

    const { address, transactionHash } = await hre.deployments.deploy('Staking', {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
      from: deployer.address,
      args: [stakingManagement, stakingPool, rewardPoolSize],
    });
    console.log('Staking deploy tx:', transactionHash);
    console.log('Staking address:', address);

    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    return new Staking__factory(deployer).attach(address);
  });
