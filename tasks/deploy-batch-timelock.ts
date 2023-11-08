import { task, types } from 'hardhat/config';
import { BatchTimelock__factory } from '../typechain';

task('deploy:batch-timelock', 'Deploy the BatchVesting contract')
  .addParam('token', 'IQT Token Address', undefined, types.string, false)
  .addParam('vestingPool', 'The vesting pool address', undefined, types.string, false)
  .setAction(async ({ token, vestingPool }, hre) => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment
    const [deployer] = await hre.ethers.getSigners();

    //eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    console.log('Deploying...', { token, vestingPool });

    if (!token) {
      throw new Error('Token address is required');
    }

    if (!vestingPool) {
      throw new Error('Vesting pool address is required');
    }

    await hre.deployments.delete('BatchTimelock');

    const { address, transactionHash } = await hre.deployments.deploy('BatchTimelock', {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
      from: deployer.address,
      args: [token, vestingPool],
    });
    console.log('BatchTimelock deploy tx:', transactionHash);
    console.log('BatchTimelock address:', address);

    return new BatchTimelock__factory(deployer).attach(address);
  });
