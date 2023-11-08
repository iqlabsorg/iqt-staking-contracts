import { task, types } from 'hardhat/config';
import { IQTMock__factory } from '../typechain';

task('deploy:iqt-mock', 'Deploy the IQTMock contract')
  .addParam('mintTo', 'IQT receiver address', undefined, types.string, false)
  .setAction(async ({ mintTo }, hre) => {
    const [deployer] = await hre.ethers.getSigners();

    console.log('Deploying...', { mintTo });

    if (!mintTo) {
      throw new Error('Token receiver address is required');
    }

    await hre.deployments.delete('IQTMock');

    const { address, transactionHash } = await hre.deployments.deploy('IQTMock', {
      from: deployer.address,
      args: [mintTo],
    });
    console.log('IQTMock deploy tx:', transactionHash);
    console.log('IQTMock address:', address);

    return new IQTMock__factory(deployer).attach(address);
  });
