import { task, types } from 'hardhat/config';
import { TimelocksList__factory } from '../typechain';

task('deploy:timelock-list', 'Deploy the TimelockList contract')
  .addParam('twelveMonthsTimelock', '12 months timelock', undefined, types.string, false)
  .addParam('eighteenMonthsTimelock', '18 months timelock', undefined, types.string, false)
  .addParam('twentyFourMonthsTimelock', '24 months timelock', undefined, types.string, false)
  .setAction(async ({ twelveMonthsTimelock, eighteenMonthsTimelock, twentyFourMonthsTimelock }, hre) => {
    const [deployer] = await hre.ethers.getSigners();

    console.log('Deploying...', { twelveMonthsTimelock, eighteenMonthsTimelock, twentyFourMonthsTimelock });

    if (!twelveMonthsTimelock) {
      throw new Error('Twelve months timelock address is required');
    }

    if (!eighteenMonthsTimelock) {
      throw new Error('Eighteen months timelock address is required');
    }

    if (!twentyFourMonthsTimelock) {
      throw new Error('Twenty four months timelock address is required');
    }

    await hre.deployments.delete('TimelocksList');

    const { address, transactionHash } = await hre.deployments.deploy('TimelocksList', {
      from: deployer.address,
      args: [twelveMonthsTimelock, eighteenMonthsTimelock, twentyFourMonthsTimelock],
    });
    console.log('TimelocksList deploy tx:', transactionHash);
    console.log('TimelocksList address:', address);

    return new TimelocksList__factory(deployer).attach(address);
  });
