import { expect } from 'chai';
import { ethers, run } from 'hardhat';
import { BigNumberish, Signer, id } from 'ethers';
import { BatchTimelock, IQTMock, TimelocksList } from '../typechain';

export const solidityIdBytes32 = (string: string): string => {
  return id(string);
};

describe('TimelocksList Contract', function () {
  let deployer: Signer;
  let vestingPool: Signer;
  let stranger: Signer;
  let timelockReceiver1: Signer;
  let timelockReceiver2: Signer;
  let iqtMock: IQTMock;
  let timelocksList: TimelocksList;
  let batchTimelockTwelveMonths: BatchTimelock;
  let batchTimelockEighteenMonths: BatchTimelock;
  let batchTimelockTwentyFourMonths: BatchTimelock;

  const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
  const TERMINATION_ADMIN_ROLE = solidityIdBytes32('TERMINATION_ADMIN');
  const TIMELOCK_CREATOR_ROLE = solidityIdBytes32('TIMELOCK_CREATOR');

  beforeEach(async function () {
    const accounts = await ethers.getSigners();
    deployer = accounts[0];
    vestingPool = accounts[1];
    stranger = accounts[2];
    timelockReceiver1 = accounts[3];
    timelockReceiver2 = accounts[4];

    const deployerAddress = await deployer.getAddress();
    const vestingPoolAddress = await vestingPool.getAddress();

    iqtMock = (await run('deploy:iqt-mock', { mintTo: deployerAddress })) as IQTMock;

    await iqtMock.connect(deployer).transfer(vestingPoolAddress, ethers.parseEther('30'));

    batchTimelockTwelveMonths = (await run('deploy:batch-timelock', {
      token: iqtMock.target,
      vestingPool: vestingPoolAddress,
    })) as BatchTimelock;

    await iqtMock.connect(vestingPool).approve(batchTimelockTwelveMonths.target, ethers.parseEther('10'));

    batchTimelockEighteenMonths = (await run('deploy:batch-timelock', {
      token: iqtMock.target,
      vestingPool: vestingPoolAddress,
    })) as BatchTimelock;

    await iqtMock.connect(vestingPool).approve(batchTimelockEighteenMonths.target, ethers.parseEther('10'));

    batchTimelockTwentyFourMonths = (await run('deploy:batch-timelock', {
      token: iqtMock.target,
      vestingPool: vestingPoolAddress,
    })) as BatchTimelock;

    await iqtMock.connect(vestingPool).approve(batchTimelockTwentyFourMonths.target, ethers.parseEther('10'));

    timelocksList = (await run('deploy:timelock-list', {
      twelveMonthsTimelock: batchTimelockTwelveMonths.target,
      eighteenMonthsTimelock: batchTimelockEighteenMonths.target,
      twentyFourMonthsTimelock: batchTimelockTwentyFourMonths.target,
    })) as TimelocksList;
  });

  describe('Deployment', function () {
    it('Should set the roles for deployer', async function () {
      const deployerAddress = await deployer.getAddress();
      const defaultAdminRole = await batchTimelockTwelveMonths.DEFAULT_ADMIN_ROLE();
      expect(await batchTimelockTwelveMonths.hasRole(defaultAdminRole, deployerAddress)).to.equal(true);
      expect(await batchTimelockTwelveMonths.hasRole(TERMINATION_ADMIN_ROLE, deployerAddress)).to.equal(true);
      expect(await batchTimelockTwelveMonths.hasRole(TIMELOCK_CREATOR_ROLE, deployerAddress)).to.equal(true);

      expect(await batchTimelockEighteenMonths.hasRole(defaultAdminRole, deployerAddress)).to.equal(true);
      expect(await batchTimelockEighteenMonths.hasRole(TERMINATION_ADMIN_ROLE, deployerAddress)).to.equal(true);
      expect(await batchTimelockEighteenMonths.hasRole(TIMELOCK_CREATOR_ROLE, deployerAddress)).to.equal(true);

      expect(await batchTimelockTwentyFourMonths.hasRole(defaultAdminRole, deployerAddress)).to.equal(true);
      expect(await batchTimelockTwentyFourMonths.hasRole(TERMINATION_ADMIN_ROLE, deployerAddress)).to.equal(true);
      expect(await batchTimelockTwentyFourMonths.hasRole(TIMELOCK_CREATOR_ROLE, deployerAddress)).to.equal(true);
    });

    it('Should set the right timelocks', async function () {
      expect(await timelocksList.getTwelveMonthsTimelockAddress()).to.equal(batchTimelockTwelveMonths.target);
      expect(await timelocksList.getEighteenMonthsTimelockAddress()).to.equal(batchTimelockEighteenMonths.target);
      expect(await timelocksList.getTwentyFourMonthsTimelockAddress()).to.equal(batchTimelockTwentyFourMonths.target);
    });
  });

  describe('Functionality', function () {
    const CLIFF_DURATION = 15_780_000; // 6 months in seconds
    const VESTING_DURATION_12_MONTHS = 31_536_000; // 1 year in seconds
    const VESTING_DURATION_18_MONTHS = 47_340_000; // 1.5 years in seconds
    const VESTING_DURATION_24_MONTHS = 63_120_000; // 2 years in seconds

    const TIMELOCK_AMOUNT: BigNumberish = ethers.parseEther('1');
    const TIMESTAMP_NOW = Math.floor(Date.now() / 1000);

    let timelockReceiver1Address: string;
    let timelockReceiver2Address: string;

    beforeEach(async function () {
      timelockReceiver1Address = await timelockReceiver1.getAddress();
      timelockReceiver2Address = await timelockReceiver2.getAddress();

      await batchTimelockTwelveMonths
        .connect(deployer)
        .addTimelock(
          timelockReceiver1Address,
          TIMELOCK_AMOUNT,
          TIMESTAMP_NOW,
          CLIFF_DURATION,
          VESTING_DURATION_12_MONTHS,
        );
      await batchTimelockEighteenMonths
        .connect(deployer)
        .addTimelock(
          timelockReceiver1Address,
          TIMELOCK_AMOUNT,
          TIMESTAMP_NOW,
          CLIFF_DURATION,
          VESTING_DURATION_18_MONTHS,
        );

      await batchTimelockEighteenMonths
        .connect(deployer)
        .addTimelock(
          timelockReceiver2Address,
          TIMELOCK_AMOUNT,
          TIMESTAMP_NOW,
          CLIFF_DURATION,
          VESTING_DURATION_18_MONTHS,
        );
      await batchTimelockTwentyFourMonths
        .connect(deployer)
        .addTimelock(
          timelockReceiver2Address,
          TIMELOCK_AMOUNT,
          TIMESTAMP_NOW,
          CLIFF_DURATION,
          VESTING_DURATION_24_MONTHS,
        );
    });

    describe('getClaimableBalances', async function () {
      // beforeEach(async function () {
      // });

      it('Should correctly return balances', async function () {
        await ethers.provider.send('evm_increaseTime', [15_780_000 + VESTING_DURATION_24_MONTHS]); // 6 months + 1 months
        await ethers.provider.send('evm_mine', []);

        const claimableBalances = await timelocksList.getClaimableBalances(timelockReceiver1Address);
        expect(claimableBalances[0]).to.equal(TIMELOCK_AMOUNT);
        expect(claimableBalances[1]).to.equal(TIMELOCK_AMOUNT);
        expect(claimableBalances[2]).to.equal(0);

        const claimableBalances2 = await timelocksList.getClaimableBalances(timelockReceiver2Address);

        expect(claimableBalances2[0]).to.equal(0);
        expect(claimableBalances2[1]).to.equal(TIMELOCK_AMOUNT);
        expect(claimableBalances2[2]).to.equal(TIMELOCK_AMOUNT);
      });
    });

    describe('getTimelocks', async function () {
      it('Should correctly return timelocks', async function () {
        await ethers.provider.send('evm_increaseTime', [15_780_000 + VESTING_DURATION_24_MONTHS]); // 6 months + 1 months
        await ethers.provider.send('evm_mine', []);

        const timelocks = await timelocksList.getTimelocks(timelockReceiver1Address);

        expect(timelocks[0].receiver).to.equal(timelockReceiver1Address);
        expect(timelocks[0].isTerminated).to.equal(false);
        expect(timelocks[0].totalAmount).to.equal(TIMELOCK_AMOUNT);
        expect(timelocks[0].releasedAmount).to.equal(0);
        expect(timelocks[0].cliffDuration).to.equal(CLIFF_DURATION);
        expect(timelocks[0].vestingDuration).to.equal(VESTING_DURATION_12_MONTHS);
        expect(timelocks[0].terminationFrom).to.equal(0);

        expect(timelocks[1].receiver).to.equal(timelockReceiver1Address);
        expect(timelocks[1].isTerminated).to.equal(false);
        expect(timelocks[1].totalAmount).to.equal(TIMELOCK_AMOUNT);
        expect(timelocks[1].releasedAmount).to.equal(0);
        expect(timelocks[1].cliffDuration).to.equal(CLIFF_DURATION);
        expect(timelocks[1].vestingDuration).to.equal(VESTING_DURATION_18_MONTHS);
        expect(timelocks[1].terminationFrom).to.equal(0);

        expect(timelocks[2].receiver).to.equal(ZERO_ADDRESS);
        expect(timelocks[2].isTerminated).to.equal(false);
        expect(timelocks[2].totalAmount).to.equal(0);
        expect(timelocks[2].releasedAmount).to.equal(0);
        expect(timelocks[2].cliffDuration).to.equal(0);
        expect(timelocks[2].vestingDuration).to.equal(0);
        expect(timelocks[2].terminationFrom).to.equal(0);

        const timelocks2 = await timelocksList.getTimelocks(timelockReceiver2Address);

        expect(timelocks2[0].receiver).to.equal(ZERO_ADDRESS);
        expect(timelocks2[0].isTerminated).to.equal(false);
        expect(timelocks2[0].totalAmount).to.equal(0);
        expect(timelocks2[0].releasedAmount).to.equal(0);
        expect(timelocks2[0].cliffDuration).to.equal(0);
        expect(timelocks2[0].vestingDuration).to.equal(0);
        expect(timelocks2[0].terminationFrom).to.equal(0);

        expect(timelocks2[1].receiver).to.equal(timelockReceiver2Address);
        expect(timelocks2[1].isTerminated).to.equal(false);
        expect(timelocks2[1].totalAmount).to.equal(TIMELOCK_AMOUNT);
        expect(timelocks2[1].releasedAmount).to.equal(0);
        expect(timelocks2[1].cliffDuration).to.equal(CLIFF_DURATION);
        expect(timelocks2[1].vestingDuration).to.equal(VESTING_DURATION_18_MONTHS);
        expect(timelocks2[1].terminationFrom).to.equal(0);

        expect(timelocks2[2].receiver).to.equal(timelockReceiver2Address);
        expect(timelocks2[2].isTerminated).to.equal(false);
        expect(timelocks2[2].totalAmount).to.equal(TIMELOCK_AMOUNT);
        expect(timelocks2[2].releasedAmount).to.equal(0);
        expect(timelocks2[2].cliffDuration).to.equal(CLIFF_DURATION);
        expect(timelocks2[2].vestingDuration).to.equal(VESTING_DURATION_24_MONTHS);
        expect(timelocks2[2].terminationFrom).to.equal(0);
      });
    });

    describe('getTimelocksData', async function () {
      it('should correctly return all timelocks data', async function () {
        let timelocksData;
        timelocksData = await timelocksList.getTimelocksData(timelockReceiver1Address);

        expect(timelocksData.claimableBalances.length).to.equal(3);
        expect(timelocksData.timelocks.length).to.equal(3);
        expect(timelocksData.totalClaimableBalance).to.equal(0);
        expect(timelocksData.twelveMonthsTimelockAddress).to.equal(batchTimelockTwelveMonths.target);
        expect(timelocksData.eighteenMonthsTimelockAddress).to.equal(batchTimelockEighteenMonths.target);
        expect(timelocksData.twentyFourMonthsTimelockAddress).to.equal(batchTimelockTwentyFourMonths.target);

        await ethers.provider.send('evm_increaseTime', [15_780_000 + VESTING_DURATION_24_MONTHS]); // 6 months + 1 months
        await ethers.provider.send('evm_mine', []);

        timelocksData = await timelocksList.getTimelocksData(timelockReceiver1Address);

        expect(timelocksData.claimableBalances.length).to.equal(3);
        expect(timelocksData.timelocks.length).to.equal(3);
        expect(timelocksData.totalClaimableBalance).to.equal(TIMELOCK_AMOUNT * BigInt(2));
        expect(timelocksData.twelveMonthsTimelockAddress).to.equal(batchTimelockTwelveMonths.target);
        expect(timelocksData.eighteenMonthsTimelockAddress).to.equal(batchTimelockEighteenMonths.target);
        expect(timelocksData.twentyFourMonthsTimelockAddress).to.equal(batchTimelockTwentyFourMonths.target);
      });
    });
  });
});
