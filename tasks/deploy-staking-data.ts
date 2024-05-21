import { task, types } from 'hardhat/config';
import { StakingData__factory } from '../typechain';

task('deploy:staking-data', 'Deploy the TimelockList contract')
  .addParam('stakingManagement', 'StakingManagement address', undefined, types.string, false)
  .addParam('staking', 'Staking address', undefined, types.string, false)
  .addParam('stakingPoolSize', 'Staking pool size', undefined, types.string, false)
  .setAction(async ({ stakingManagement, staking, stakingPoolSize }, hre) => {
    const [deployer] = await hre.ethers.getSigners();

    console.log('Deploying...', { stakingManagement, staking, stakingPoolSize });

    if (!stakingManagement) {
      throw new Error('Staking Management is required');
    }

    if (!staking) {
      throw new Error('Staking is required');
    }

    if (!stakingPoolSize) {
      throw new Error('Staking Pool Size is required');
    }

    await hre.deployments.delete('StakingData');

    const { address, transactionHash } = await hre.deployments.deploy('StakingData', {
      from: deployer.address,
      args: [stakingManagement, staking, stakingPoolSize],
    });
    console.log('StakingData deploy tx:', transactionHash);
    console.log('StakingData address:', address);

    return new StakingData__factory(deployer).attach(address);
  });
