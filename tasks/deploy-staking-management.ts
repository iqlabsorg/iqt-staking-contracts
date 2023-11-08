import { task, types } from 'hardhat/config';
import { StakingManagement__factory } from '../typechain';

task('deploy:staking-management', 'Deploy the StakingManagement contract')
  .addParam('stakingToken', 'IQT Token Address', undefined, types.string, false)
  .setAction(async ({ stakingToken }, hre) => {
    const [deployer] = await hre.ethers.getSigners();

    console.log('Deploying...', { stakingToken });

    if (!stakingToken) {
      throw new Error('Token address is required');
    }

    await hre.deployments.delete('StakingManagement');

    const { address, transactionHash } = await hre.deployments.deploy('StakingManagement', {
      from: deployer.address,
      args: [stakingToken],
    });
    console.log('StakingManagement deploy tx:', transactionHash);
    console.log('StakingManagement address:', address);

    return new StakingManagement__factory(deployer).attach(address);
  });
