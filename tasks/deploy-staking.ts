import { task, types } from 'hardhat/config';
import { StakingManagement__factory, Staking__factory } from '../typechain';

task('deploy:staking', 'Deploy the Staking contract')
  .addParam('stakingManagement', 'StakingManagement Contract Address', undefined, types.string, false)
  .addParam('stakingPool', 'Address of staking pool', undefined, types.string, false)
  .setAction(async ({ stakingManagement, stakingPool }, hre) => {
    const [deployer] = await hre.ethers.getSigners();

    console.log('Deploying...', { stakingManagement });

    if (!stakingManagement) {
      throw new Error('Staking Management is required');
    }

    if (!stakingPool) {
      throw new Error('Staking Pool is required');
    }

    await hre.deployments.delete('Staking');

    const { address, transactionHash } = await hre.deployments.deploy('Staking', {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
      from: deployer.address,
      args: [stakingManagement, stakingPool],
    });
    console.log('Staking deploy tx:', transactionHash);
    console.log('Staking address:', address);

    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    return new Staking__factory(deployer).attach(address);
  });
