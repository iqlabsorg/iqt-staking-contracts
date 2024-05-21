import { task, types } from 'hardhat/config';
import {
  ERC20__factory,
  IQTMock,
  IQTMock__factory,
  Staking,
  StakingManagement,
  StakingManagement__factory,
  Staking__factory,
} from '../typechain';
import { id } from 'ethers';

export const solidityIdBytes32 = (string: string): string => {
  return id(string);
};

const STAKING_MANAGER_ROLE = solidityIdBytes32('STAKING_MANAGER');

task('deploy:setup-staking', 'Deploy and setup the whole Staking structure')
  .addParam('stakingPoolAddress', 'Address of staking pool', undefined, types.string, false)
  .addParam('stakingPoolSize', 'Staking Pool Size', undefined, types.string, false)
  .addParam('stakingTokenAddress', 'IQT Token Address', undefined, types.string, true)
  .setAction(async ({ stakingPoolAddress, stakingPoolSize, stakingTokenAddress }, hre) => {
    let stakingToken;
    const [deployer] = await hre.ethers.getSigners();

    console.log('Deploying...', { stakingPoolAddress, stakingTokenAddress });

    if (!stakingPoolAddress) {
      throw new Error('Staking Pool is required');
    }

    if (!stakingPoolSize) {
      throw new Error('Staking Pool Size is required');
    } else {
      stakingPoolSize = hre.ethers.parseEther(stakingPoolSize);
    }

    if (!stakingTokenAddress) {
      await hre.deployments.delete('IQTMock');
      stakingToken = (await hre.run('deploy:iqt-mock', { mintTo: deployer.address })) as IQTMock;
      stakingTokenAddress = stakingToken.target;
    } else {
      stakingToken = new IQTMock__factory(deployer).attach(stakingTokenAddress) as IQTMock;
    }

    await hre.deployments.delete('StakingManagement');
    await hre.deployments.delete('Staking');

    console.log('Staking Token:', stakingTokenAddress);

    const stakingManagement = (await hre.run('deploy:staking-management', {
      stakingToken: stakingTokenAddress,
    })) as StakingManagement;

    console.log('StakingManagement address:', stakingManagement.target);

    const staking = (await hre.run('deploy:staking', {
      stakingManagement: stakingManagement.target,
      stakingPool: stakingPoolAddress,
    })) as Staking;

    console.log('Staking address:', staking.target);

    await stakingManagement.connect(deployer).setStaking(staking.target);
    await stakingManagement.connect(deployer).grantRole(STAKING_MANAGER_ROLE, stakingManagement.target);
    await stakingToken.connect(deployer).approve(staking.target, stakingPoolSize);

    return {
      stakingManagement: new StakingManagement__factory(deployer).attach(stakingManagement.target),
      staking: new Staking__factory(deployer).attach(staking.target),
    };
  });
