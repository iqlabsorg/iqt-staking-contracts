import { expect } from 'chai';
import { ethers, run } from 'hardhat';
import { BigNumberish, Signer, formatEther, formatUnits, id, parseUnits } from 'ethers';
import { StakingManagement, Staking, IQTMock } from '../typechain';

export const solidityIdBytes32 = (string: string): string => {
  return id(string);
};

describe('Staking Contract', function () {
  let deployer: Signer;
  let stakingManager: Signer;
  let stranger: Signer;
  let staker1: Signer;
  let staker2: Signer;
  let staker3: Signer;
  let staker4: Signer;
  let stakingPool: Signer;
  let stakingToken: IQTMock;
  let staking: Staking;
  let stakingManagement: StakingManagement;

  const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
  const STAKING_MANAGER_ROLE = solidityIdBytes32('STAKING_MANAGER');
  const STAKER_BALANCE = 10000;
  const ZERO_AMOUNT = 0;
  const STAKING_REWARD_POOL_SIZE = ethers.parseEther('50000000');
  const MAX_STAKING_AMOUNT = ethers.parseEther('50000000');

  beforeEach(async function () {
    const accounts = await ethers.getSigners();

    deployer = accounts[0];
    stakingManager = accounts[1];
    stranger = accounts[2];
    staker1 = accounts[3];
    staker2 = accounts[4];
    staker3 = accounts[5];
    staker4 = accounts[6];
    stakingPool = accounts[7];

    const deployerAddress = await deployer.getAddress();
    const stakingManagerAddress = await stakingManager.getAddress();
    const stakingPoolAddress = await stakingPool.getAddress();

    stakingToken = (await run('deploy:iqt-mock', { mintTo: deployerAddress })) as IQTMock;
    await stakingToken.connect(deployer).transfer(stakingPoolAddress, STAKING_REWARD_POOL_SIZE);
    stakingManagement = (await run('deploy:staking-management', {
      stakingToken: stakingToken.target,
    })) as StakingManagement;
    staking = (await run('deploy:staking', {
      stakingManagement: stakingManagement.target,
      stakingPool: stakingPoolAddress,
      rewardPoolSize: STAKING_REWARD_POOL_SIZE.toString(),
    })) as Staking;

    await stakingManagement.connect(deployer).setStaking(staking.target);
    await stakingManagement.connect(deployer).grantRole(STAKING_MANAGER_ROLE, stakingManagerAddress);
    await stakingToken.connect(stakingPool).approve(staking.target, STAKING_REWARD_POOL_SIZE);
  });

  describe('Deployment', function () {
    it('Should set the correct StakingManagement address', async function () {
      expect(await staking.getStakingManagement()).to.equal(stakingManagement.target);
    });

    it('Should set the correct StakingToken address', async function () {
      expect(await staking.getStakingToken()).to.equal(stakingToken.target);
    });

    it('Should set the correct StakingPool address', async function () {
      const stakingPoolAddress = await stakingPool.getAddress();
      expect(await staking.getStakingPool()).to.equal(stakingPoolAddress);
    });
  });

  describe('Functionality', function () {
    describe('stake', function () {
      /** APYs */
      const THREE_MONTHS_APY = 30_00;
      const SIX_MONTHS_APY = 50_00;
      const TWELVE_MONTHS_APY = 70_00;
      const TWENTY_FOUR_MONTHS_APY = 90_00;
      /** Time Frames */
      const THREE_MONTHS_IN_SECONDS = 7889238;
      const SIX_MONTHS_IN_SECONDS = 15778476;
      const TWELVE_MONTHS_IN_SECONDS = 31556952;
      const TWENTY_FOUR_MONTHS_IN_SECONDS = 63113904;
      /** Staking amounts */
      const STAKING_AMOUNT = ethers.parseEther('100');
      const MORE_THAN_STAKING_AMOUNT = ethers.parseEther('101');
      const QUARTER_STAKING_AMOUNT = ethers.parseEther('25');
      const LESS_THAN_QUARTER_STAKING_AMOUNT = ethers.parseEther('24');
      const MORE_THAN_QUARTER_STAKING_AMOUNT = ethers.parseEther('26');
      const NON_EXISTING_PLAN_ID = 999;

      let threeMonthsStakingPlanId: BigNumberish;
      let sixMonthsStakingPlanId: BigNumberish;
      let twelveMonthsStakingPlanId: BigNumberish;
      let twentyFourMonthsStakingPlanId: BigNumberish;

      beforeEach(async function () {
        const staker1Address = await staker1.getAddress();
        const stakingPoolAddress = await stakingPool.getAddress();
        await stakingToken.connect(deployer).transfer(staker1Address, STAKING_AMOUNT);
        await stakingToken.connect(staker1).approve(staking.target, STAKING_AMOUNT);
        threeMonthsStakingPlanId = await stakingManagement
          .connect(stakingManager)
          .addStakingPlan.staticCall(THREE_MONTHS_IN_SECONDS, THREE_MONTHS_APY);
        await stakingManagement.connect(stakingManager).addStakingPlan(THREE_MONTHS_IN_SECONDS, THREE_MONTHS_APY);
        sixMonthsStakingPlanId = await stakingManagement
          .connect(stakingManager)
          .addStakingPlan.staticCall(SIX_MONTHS_IN_SECONDS, SIX_MONTHS_APY);
        await stakingManagement.connect(stakingManager).addStakingPlan(SIX_MONTHS_IN_SECONDS, SIX_MONTHS_APY);
        twelveMonthsStakingPlanId = await stakingManagement
          .connect(stakingManager)
          .addStakingPlan.staticCall(TWELVE_MONTHS_IN_SECONDS, TWELVE_MONTHS_APY);
        await stakingManagement.connect(stakingManager).addStakingPlan(TWELVE_MONTHS_IN_SECONDS, TWELVE_MONTHS_APY);
        twentyFourMonthsStakingPlanId = await stakingManagement.addStakingPlan.staticCall(
          TWENTY_FOUR_MONTHS_IN_SECONDS,
          TWENTY_FOUR_MONTHS_APY,
        );
        await stakingManagement
          .connect(stakingManager)
          .addStakingPlan(TWENTY_FOUR_MONTHS_IN_SECONDS, TWENTY_FOUR_MONTHS_APY);

        await stakingManagement
          .connect(stakingManager)
          .setStakingLimits(QUARTER_STAKING_AMOUNT, QUARTER_STAKING_AMOUNT);
      });

      it('should stake', async function () {
        const firstPlan = await stakingManagement.getStakingPlan(threeMonthsStakingPlanId);
        console.log('FIRST PLAN: ', firstPlan);
        console.log('FIRST PLAN ID: ', threeMonthsStakingPlanId);
        await expect(staking.connect(staker1).stake(QUARTER_STAKING_AMOUNT, threeMonthsStakingPlanId)).to.not.be.reverted;
      });

      it('should emit an event when staking', async function () {
        const staker1Address = await staker1.getAddress();
        const expectedStakeId = await staking
          .connect(staker1)
          .stake.staticCall(QUARTER_STAKING_AMOUNT, threeMonthsStakingPlanId);
        await expect(staking.connect(staker1).stake(QUARTER_STAKING_AMOUNT, threeMonthsStakingPlanId))
          .to.emit(staking, 'StakeAdded')
          .withArgs(staker1Address, expectedStakeId);
      });

      it('should increase amount of stakes per plan', async function () {
        let stakesPerPlan;
        const staker1Address = await staker1.getAddress();
        stakesPerPlan = await staking.getStakesAmountPerPlan(threeMonthsStakingPlanId);
        expect(stakesPerPlan).to.equal(0);
        await expect(staking.connect(staker1).stake(QUARTER_STAKING_AMOUNT, threeMonthsStakingPlanId)).to.not.be.reverted;
        stakesPerPlan = await staking.getStakesAmountPerPlan(threeMonthsStakingPlanId);
        expect(stakesPerPlan).to.equal(1);
      });

      it('should work well with 3 months staking plan', async function () {
        const staker1Address = await staker1.getAddress();
        const balanceBeforeWithdrawal = await stakingToken.balanceOf(staker1Address);

        const stakeId = await staking.connect(staker1).stake.staticCall(QUARTER_STAKING_AMOUNT, threeMonthsStakingPlanId);
        await staking.connect(staker1).stake(QUARTER_STAKING_AMOUNT, threeMonthsStakingPlanId);
        let stakeRecord = await staking.getStake(stakeId);
        expect(stakeRecord.staker).to.equal(staker1Address);
        expect(stakeRecord.amount).to.equal(QUARTER_STAKING_AMOUNT);
        expect(stakeRecord.stakingPlanId).to.equal(threeMonthsStakingPlanId);
        expect(stakeRecord.earningsInTokens).to.equal(0n);
        expect(stakeRecord.earningsPercentage).to.equal(0n);
        expect(stakeRecord.earlyWithdrawal).to.equal(false);
        expect(stakeRecord.withdrawn).to.equal(false);
        expect(stakeRecord.startTimestamp).to.be.gt(0);
        expect(stakeRecord.endTimestamp).to.be.gt(stakeRecord.startTimestamp);

        const estimatedEarnings = await staking.estimateStakeEarnings(
          QUARTER_STAKING_AMOUNT,
          threeMonthsStakingPlanId,
        );

        console.log('ESTIMATED EARNINGS: ', estimatedEarnings);

        let calculateStakeEarnings;


        await ethers.provider.send('evm_increaseTime', [THREE_MONTHS_IN_SECONDS / 3]);
        await ethers.provider.send('evm_mine');

        calculateStakeEarnings = await staking.calculateStakeEarnings(stakeId);

        console.log('1/3 TIME PASSED: ', calculateStakeEarnings);

        const oneThirdOfEstimatedEarnings = Number(formatEther(estimatedEarnings.predictedEarningsInTokens.toString())) / 3;
        const numberOfCalculatedEarnings = Number(formatEther(calculateStakeEarnings.earningsInTokens.toString()));
        expect(Math.round(oneThirdOfEstimatedEarnings / numberOfCalculatedEarnings)).to.be.eq(1);

        await ethers.provider.send('evm_increaseTime', [THREE_MONTHS_IN_SECONDS / 3]);
        await ethers.provider.send('evm_mine');

        calculateStakeEarnings = await staking.calculateStakeEarnings(stakeId);

        console.log('2/3 TIME PASSED: ', calculateStakeEarnings);

        const twoThirdsOfEstimatedEarnings = (Number(formatEther(estimatedEarnings.predictedEarningsInTokens.toString())) / 3) * 2;
        const numberOfCalculatedEarnings2 = Number(formatEther(calculateStakeEarnings.earningsInTokens.toString()));
        expect(Math.round(twoThirdsOfEstimatedEarnings / numberOfCalculatedEarnings2)).to.be.eq(1);

        await ethers.provider.send('evm_increaseTime', [THREE_MONTHS_IN_SECONDS / 3]);
        await ethers.provider.send('evm_mine');

        calculateStakeEarnings = await staking.calculateStakeEarnings(stakeId);

        console.log('3/3 TIME PASSED: ', calculateStakeEarnings);

        await staking.connect(staker1).withdraw(stakeId);

        const balanceAfterWithdraw = await stakingToken.balanceOf(staker1Address);
        const stakeEarnings = await staking.calculateStakeEarnings(stakeId);
        const expectedFirstStakeEarnings = calculateExpectedEarnings({
          stakingAmount: QUARTER_STAKING_AMOUNT,
          stakingPeriod: BigInt(THREE_MONTHS_IN_SECONDS),
          apy: BigInt(THREE_MONTHS_APY),
        });

        stakeRecord = await staking.getStake(stakeId);

        expect(expectedFirstStakeEarnings.expectedEarningsInTokens).to.be.eq(stakeEarnings.earningsInTokens);
        expect(expectedFirstStakeEarnings.expectedEarningsPercentage).to.be.eq(stakeEarnings.earningsPercentage);
        expect(expectedFirstStakeEarnings.expectedEarningsInTokens).to.equal(stakeEarnings.earningsInTokens);
        expect(expectedFirstStakeEarnings.expectedEarningsPercentage).to.equal(stakeEarnings.earningsPercentage);
        expect(balanceAfterWithdraw).to.equal(balanceBeforeWithdrawal + expectedFirstStakeEarnings.expectedEarningsInTokens);
        expect(stakeRecord.earningsInTokens).to.equal(expectedFirstStakeEarnings.expectedEarningsInTokens);
        expect(stakeRecord.earningsPercentage).to.equal(expectedFirstStakeEarnings.expectedEarningsPercentage);
      });

      it('should work well with 6 months staking plan', async function () {
        const staker1Address = await staker1.getAddress();
        const balanceBeforeWithdrawal = await stakingToken.balanceOf(staker1Address);

        const stakeId = await staking.connect(staker1).stake.staticCall(QUARTER_STAKING_AMOUNT, sixMonthsStakingPlanId);
        await staking.connect(staker1).stake(QUARTER_STAKING_AMOUNT, sixMonthsStakingPlanId);
        let stakeRecord = await staking.getStake(stakeId);
        expect(stakeRecord.staker).to.equal(staker1Address);
        expect(stakeRecord.amount).to.equal(QUARTER_STAKING_AMOUNT);
        expect(stakeRecord.stakingPlanId).to.equal(sixMonthsStakingPlanId);
        expect(stakeRecord.earningsInTokens).to.equal(0n);
        expect(stakeRecord.earningsPercentage).to.equal(0n);
        expect(stakeRecord.earlyWithdrawal).to.equal(false);
        expect(stakeRecord.withdrawn).to.equal(false);
        expect(stakeRecord.startTimestamp).to.be.gt(0);
        expect(stakeRecord.endTimestamp).to.be.gt(stakeRecord.startTimestamp);

        const estimatedEarnings = await staking.estimateStakeEarnings(
          QUARTER_STAKING_AMOUNT,
          sixMonthsStakingPlanId,
        );

        console.log('ESTIMATED EARNINGS: ', estimatedEarnings);

        let calculateStakeEarnings;

        await ethers.provider.send('evm_increaseTime', [SIX_MONTHS_IN_SECONDS / 3]);
        await ethers.provider.send('evm_mine');

        calculateStakeEarnings = await staking.calculateStakeEarnings(stakeId);

        console.log('1/3 TIME PASSED: ', calculateStakeEarnings);

        const oneThirdOfEstimatedEarnings = Number(formatEther(estimatedEarnings.predictedEarningsInTokens.toString())) / 3;
        const numberOfCalculatedEarnings = Number(formatEther(calculateStakeEarnings.earningsInTokens.toString()));
        expect(Math.round(oneThirdOfEstimatedEarnings / numberOfCalculatedEarnings)).to.be.eq(1);

        await ethers.provider.send('evm_increaseTime', [SIX_MONTHS_IN_SECONDS / 3]);
        await ethers.provider.send('evm_mine');

        calculateStakeEarnings = await staking.calculateStakeEarnings(stakeId);

        console.log('2/3 TIME PASSED: ', calculateStakeEarnings);

        const twoThirdsOfEstimatedEarnings = (Number(formatEther(estimatedEarnings.predictedEarningsInTokens.toString())) / 3) * 2;
        const numberOfCalculatedEarnings2 = Number(formatEther(calculateStakeEarnings.earningsInTokens.toString()));
        expect(Math.round(twoThirdsOfEstimatedEarnings / numberOfCalculatedEarnings2)).to.be.eq(1);

        await ethers.provider.send('evm_increaseTime', [SIX_MONTHS_IN_SECONDS / 3]);
        await ethers.provider.send('evm_mine');

        calculateStakeEarnings = await staking.calculateStakeEarnings(stakeId);

        console.log('3/3 TIME PASSED: ', calculateStakeEarnings);

        await staking.connect(staker1).withdraw(stakeId);

        const balanceAfterWithdraw = await stakingToken.balanceOf(staker1Address);
        const stakeEarnings = await staking.calculateStakeEarnings(stakeId);
        const expectedFirstStakeEarnings = calculateExpectedEarnings({
          stakingAmount: QUARTER_STAKING_AMOUNT,
          stakingPeriod: BigInt(SIX_MONTHS_IN_SECONDS),
          apy: BigInt(SIX_MONTHS_APY),
        });

        stakeRecord = await staking.getStake(stakeId);

        expect(expectedFirstStakeEarnings.expectedEarningsInTokens).to.be.eq(stakeEarnings.earningsInTokens);
        expect(expectedFirstStakeEarnings.expectedEarningsPercentage).to.be.eq(stakeEarnings.earningsPercentage);
        expect(expectedFirstStakeEarnings.expectedEarningsInTokens).to.equal(stakeEarnings.earningsInTokens);
        expect(expectedFirstStakeEarnings.expectedEarningsPercentage).to.equal(stakeEarnings.earningsPercentage);
        expect(balanceAfterWithdraw).to.equal(balanceBeforeWithdrawal + expectedFirstStakeEarnings.expectedEarningsInTokens);
        expect(stakeRecord.earningsInTokens).to.equal(expectedFirstStakeEarnings.expectedEarningsInTokens);
        expect(stakeRecord.earningsPercentage).to.equal(expectedFirstStakeEarnings.expectedEarningsPercentage);
      });

      it('should work well with 12 months staking plan', async function () {
        const staker1Address = await staker1.getAddress();
        const balanceBeforeWithdrawal = await stakingToken.balanceOf(staker1Address);

        const stakeId = await staking.connect(staker1).stake.staticCall(QUARTER_STAKING_AMOUNT, twelveMonthsStakingPlanId);
        await staking.connect(staker1).stake(QUARTER_STAKING_AMOUNT, twelveMonthsStakingPlanId);
        let stakeRecord = await staking.getStake(stakeId);
        expect(stakeRecord.staker).to.equal(staker1Address);
        expect(stakeRecord.amount).to.equal(QUARTER_STAKING_AMOUNT);
        expect(stakeRecord.stakingPlanId).to.equal(twelveMonthsStakingPlanId);
        expect(stakeRecord.earningsInTokens).to.equal(0n);
        expect(stakeRecord.earningsPercentage).to.equal(0n);
        expect(stakeRecord.earlyWithdrawal).to.equal(false);
        expect(stakeRecord.withdrawn).to.equal(false);
        expect(stakeRecord.startTimestamp).to.be.gt(0);
        expect(stakeRecord.endTimestamp).to.be.gt(stakeRecord.startTimestamp);

        const estimatedEarnings = await staking.estimateStakeEarnings(
          QUARTER_STAKING_AMOUNT,
          twelveMonthsStakingPlanId,
        );

        console.log('ESTIMATED EARNINGS: ', estimatedEarnings);

        let calculateStakeEarnings;

        await ethers.provider.send('evm_increaseTime', [TWELVE_MONTHS_IN_SECONDS / 3]);
        await ethers.provider.send('evm_mine');

        calculateStakeEarnings = await staking.calculateStakeEarnings(stakeId);

        console.log('1/3 TIME PASSED: ', calculateStakeEarnings);

        const oneThirdOfEstimatedEarnings = Number(formatEther(estimatedEarnings.predictedEarningsInTokens.toString())) / 3;
        const numberOfCalculatedEarnings = Number(formatEther(calculateStakeEarnings.earningsInTokens.toString()));
        expect(Math.round(oneThirdOfEstimatedEarnings / numberOfCalculatedEarnings)).to.be.eq(1);

        await ethers.provider.send('evm_increaseTime', [TWELVE_MONTHS_IN_SECONDS / 3]);
        await ethers.provider.send('evm_mine');

        calculateStakeEarnings = await staking.calculateStakeEarnings(stakeId);

        console.log('2/3 TIME PASSED: ', calculateStakeEarnings);

        const twoThirdsOfEstimatedEarnings = (Number(formatEther(estimatedEarnings.predictedEarningsInTokens.toString())) / 3) * 2;
        const numberOfCalculatedEarnings2 = Number(formatEther(calculateStakeEarnings.earningsInTokens.toString()));
        expect(Math.round(twoThirdsOfEstimatedEarnings / numberOfCalculatedEarnings2)).to.be.eq(1);

        await ethers.provider.send('evm_increaseTime', [TWELVE_MONTHS_IN_SECONDS / 3]);
        await ethers.provider.send('evm_mine');

        calculateStakeEarnings = await staking.calculateStakeEarnings(stakeId);

        console.log('3/3 TIME PASSED: ', calculateStakeEarnings);

        await staking.connect(staker1).withdraw(stakeId);

        const balanceAfterWithdraw = await stakingToken.balanceOf(staker1Address);
        const stakeEarnings = await staking.calculateStakeEarnings(stakeId);
        const expectedFirstStakeEarnings = calculateExpectedEarnings({
          stakingAmount: QUARTER_STAKING_AMOUNT,
          stakingPeriod: BigInt(TWELVE_MONTHS_IN_SECONDS),
          apy: BigInt(TWELVE_MONTHS_APY),
        });

        stakeRecord = await staking.getStake(stakeId);

        expect(expectedFirstStakeEarnings.expectedEarningsInTokens).to.be.eq(stakeEarnings.earningsInTokens);
        expect(expectedFirstStakeEarnings.expectedEarningsPercentage).to.be.eq(stakeEarnings.earningsPercentage);
        expect(expectedFirstStakeEarnings.expectedEarningsInTokens).to.equal(stakeEarnings.earningsInTokens);
        expect(expectedFirstStakeEarnings.expectedEarningsPercentage).to.equal(stakeEarnings.earningsPercentage);
        expect(balanceAfterWithdraw).to.equal(balanceBeforeWithdrawal + expectedFirstStakeEarnings.expectedEarningsInTokens);
        expect(stakeRecord.earningsInTokens).to.equal(expectedFirstStakeEarnings.expectedEarningsInTokens);
        expect(stakeRecord.earningsPercentage).to.equal(expectedFirstStakeEarnings.expectedEarningsPercentage);
      });

      it('should work well with 24 months staking plan', async function () {
        const staker1Address = await staker1.getAddress();
        const balanceBeforeWithdrawal = await stakingToken.balanceOf(staker1Address);

        const stakeId = await staking.connect(staker1).stake.staticCall(QUARTER_STAKING_AMOUNT, twentyFourMonthsStakingPlanId);
        await staking.connect(staker1).stake(QUARTER_STAKING_AMOUNT, twentyFourMonthsStakingPlanId);
        let stakeRecord = await staking.getStake(stakeId);
        expect(stakeRecord.staker).to.equal(staker1Address);
        expect(stakeRecord.amount).to.equal(QUARTER_STAKING_AMOUNT);
        expect(stakeRecord.stakingPlanId).to.equal(twentyFourMonthsStakingPlanId);
        expect(stakeRecord.earningsInTokens).to.equal(0n);
        expect(stakeRecord.earningsPercentage).to.equal(0n);
        expect(stakeRecord.earlyWithdrawal).to.equal(false);
        expect(stakeRecord.withdrawn).to.equal(false);
        expect(stakeRecord.startTimestamp).to.be.gt(0);
        expect(stakeRecord.endTimestamp).to.be.gt(stakeRecord.startTimestamp);

        const estimatedEarnings = await staking.estimateStakeEarnings(
          QUARTER_STAKING_AMOUNT,
          twentyFourMonthsStakingPlanId,
        );

        console.log('ESTIMATED EARNINGS: ', estimatedEarnings);

        let calculateStakeEarnings;

        await ethers.provider.send('evm_increaseTime', [TWENTY_FOUR_MONTHS_IN_SECONDS / 3]);
        await ethers.provider.send('evm_mine');

        calculateStakeEarnings = await staking.calculateStakeEarnings(stakeId);

        console.log('1/3 TIME PASSED: ', calculateStakeEarnings);

        const oneThirdOfEstimatedEarnings = Number(formatEther(estimatedEarnings.predictedEarningsInTokens.toString())) / 3;
        const numberOfCalculatedEarnings = Number(formatEther(calculateStakeEarnings.earningsInTokens.toString()));
        expect(Math.round(oneThirdOfEstimatedEarnings / numberOfCalculatedEarnings)).to.be.eq(1);

        await ethers.provider.send('evm_increaseTime', [TWENTY_FOUR_MONTHS_IN_SECONDS / 3]);
        await ethers.provider.send('evm_mine');

        calculateStakeEarnings = await staking.calculateStakeEarnings(stakeId);

        console.log('2/3 TIME PASSED: ', calculateStakeEarnings);

        const twoThirdsOfEstimatedEarnings = (Number(formatEther(estimatedEarnings.predictedEarningsInTokens.toString())) / 3) * 2;
        const numberOfCalculatedEarnings2 = Number(formatEther(calculateStakeEarnings.earningsInTokens.toString()));

        await ethers.provider.send('evm_increaseTime', [TWENTY_FOUR_MONTHS_IN_SECONDS / 3]);
        await ethers.provider.send('evm_mine');

        calculateStakeEarnings = await staking.calculateStakeEarnings(stakeId);

        console.log('3/3 TIME PASSED: ', calculateStakeEarnings);

        await staking.connect(staker1).withdraw(stakeId);

        const balanceAfterWithdraw = await stakingToken.balanceOf(staker1Address);
        const stakeEarnings = await staking.calculateStakeEarnings(stakeId);
        const expectedFirstStakeEarnings = calculateExpectedEarnings({
          stakingAmount: QUARTER_STAKING_AMOUNT,
          stakingPeriod: BigInt(TWENTY_FOUR_MONTHS_IN_SECONDS),
          apy: BigInt(TWENTY_FOUR_MONTHS_APY),
        });

        stakeRecord = await staking.getStake(stakeId);

        expect(expectedFirstStakeEarnings.expectedEarningsInTokens).to.be.eq(stakeEarnings.earningsInTokens);
        expect(expectedFirstStakeEarnings.expectedEarningsPercentage).to.be.eq(stakeEarnings.earningsPercentage);
        expect(expectedFirstStakeEarnings.expectedEarningsInTokens).to.equal(stakeEarnings.earningsInTokens);
        expect(expectedFirstStakeEarnings.expectedEarningsPercentage).to.equal(stakeEarnings.earningsPercentage);
        expect(balanceAfterWithdraw).to.equal(balanceBeforeWithdrawal + expectedFirstStakeEarnings.expectedEarningsInTokens);
        expect(stakeRecord.earningsInTokens).to.equal(expectedFirstStakeEarnings.expectedEarningsInTokens);
        expect(stakeRecord.earningsPercentage).to.equal(expectedFirstStakeEarnings.expectedEarningsPercentage);
      });

      it('Should not assume any earnings if staking period is zero', async function () {
        const staker1Address = await staker1.getAddress();
        const stakeId = await staking.connect(staker1).stake.staticCall(QUARTER_STAKING_AMOUNT, threeMonthsStakingPlanId);
        await staking.connect(staker1).stake(QUARTER_STAKING_AMOUNT, threeMonthsStakingPlanId);
        const staker1BalanceAfterStaking = await stakingToken.balanceOf(staker1Address);
        const stakeEarnings = await staking.calculateStakeEarnings(stakeId);
        expect(stakeEarnings.earningsInTokens).to.equal(0n);
        expect(stakeEarnings.earningsPercentage).to.equal(0n);
        expect(staker1BalanceAfterStaking).to.equal(STAKING_AMOUNT - QUARTER_STAKING_AMOUNT);
      });

      it('Should not count any earnings if doing early withdrawal', async function () {
        const staker1Address = await staker1.getAddress();
        const stakeId = await staking.connect(staker1).stake.staticCall(QUARTER_STAKING_AMOUNT, threeMonthsStakingPlanId);
        await staking.connect(staker1).stake(QUARTER_STAKING_AMOUNT, threeMonthsStakingPlanId);
        await stakingManagement.connect(deployer).enableWithdraw();
        await ethers.provider.send('evm_increaseTime', [THREE_MONTHS_IN_SECONDS / 2]);
        await ethers.provider.send('evm_mine');
        await staking.connect(staker1).withdraw(stakeId);
        const staker1BalanceAfterWithdraw = await stakingToken.balanceOf(staker1Address);
        expect(staker1BalanceAfterWithdraw).to.equal(STAKING_AMOUNT);
      });

      it('Should revert when staking amount is less than minimum staking amount', async function () {
        await expect(
          staking.connect(staker1).stake(LESS_THAN_QUARTER_STAKING_AMOUNT, threeMonthsStakingPlanId),
        ).to.be.revertedWithCustomError(staking, 'AmountIsLessThanMinimumStake');
      });

      it('Should revert when staking amount is more than maximum staking amount', async function () {
        await expect(
          staking.connect(staker1).stake(MORE_THAN_QUARTER_STAKING_AMOUNT, threeMonthsStakingPlanId),
        ).to.be.revertedWithCustomError(staking, 'AmountIsGreaterThanMaximumStake');
      });

      it('Should revert when staking pool balance is not enough to cover rewards', async function () {
        await staking.setRewardPoolSize(QUARTER_STAKING_AMOUNT);
        await stakingToken.connect(deployer).transfer(staker1.getAddress(), STAKING_REWARD_POOL_SIZE);
        await stakingManagement.connect(deployer).setMaximumStake(STAKING_REWARD_POOL_SIZE);

        await expect(
          staking.connect(staker1).stake(STAKING_REWARD_POOL_SIZE, threeMonthsStakingPlanId),
        ).to.be.revertedWithCustomError(staking, 'InsufficientRewardPoolBalance');
      });

      it('Should revert when allowance is not given to staking contract', async function () {
        await stakingToken.connect(staker1).approve(staking.target, 0);
        await expect(staking.connect(staker1).stake(QUARTER_STAKING_AMOUNT, threeMonthsStakingPlanId)).to.be.revertedWith(
          'ERC20: insufficient allowance',
        );
      });

      it('Should revert when staking plan does not exist', async function () {
        await expect(
          staking.connect(staker1).stake(QUARTER_STAKING_AMOUNT, NON_EXISTING_PLAN_ID),
        ).to.be.revertedWithCustomError(stakingManagement, 'StakingPlanDoesNotExist');
      });
    });

    describe('withdraw', function () {
      /** APYs */
      const THREE_MONTHS_APY = 30_00;
      /** Time Frames */
      const THREE_MONTHS_IN_SECONDS = 2629746;
      /** Staking amounts */
      const STAKING_AMOUNT = ethers.parseEther('100');
      const QUARTER_STAKING_AMOUNT = ethers.parseEther('25');
      const NON_EXISTING_PLAN_ID = 999;
      const NON_EXISTING_STAKE_ID = 999;

      let threeMonthsStakingPlanId: BigNumberish;

      beforeEach(async function () {
        const staker1Address = await staker1.getAddress();
        const staker2Address = await staker2.getAddress();
        const staker3Address = await staker3.getAddress();
        const staker4Address = await staker4.getAddress();
        await stakingToken.connect(deployer).transfer(staker1Address, STAKING_AMOUNT);
        await stakingToken.connect(staker1).approve(staking.target, STAKING_AMOUNT);
        await stakingToken.connect(deployer).transfer(staker2Address, STAKING_AMOUNT);
        await stakingToken.connect(staker2).approve(staking.target, STAKING_AMOUNT);
        await stakingToken.connect(deployer).transfer(staker3Address, STAKING_AMOUNT);
        await stakingToken.connect(staker3).approve(staking.target, STAKING_AMOUNT);
        await stakingToken.connect(deployer).transfer(staker4Address, STAKING_AMOUNT);
        await stakingToken.connect(staker4).approve(staking.target, STAKING_AMOUNT);
        threeMonthsStakingPlanId = await stakingManagement.addStakingPlan.staticCall(
          THREE_MONTHS_IN_SECONDS,
          THREE_MONTHS_APY,
        );
        await stakingManagement.connect(stakingManager).addStakingPlan(THREE_MONTHS_IN_SECONDS, THREE_MONTHS_APY);
        await stakingManagement
          .connect(stakingManager)
          .setStakingLimits(QUARTER_STAKING_AMOUNT, QUARTER_STAKING_AMOUNT);
      });

      it('should withdraw', async function () {
        const stakeId = await staking.connect(staker1).stake.staticCall(QUARTER_STAKING_AMOUNT, threeMonthsStakingPlanId);
        const estimatedStakeEarnings = await staking.estimateStakeEarnings(
          QUARTER_STAKING_AMOUNT,
          threeMonthsStakingPlanId,
        );
        await staking.connect(staker1).stake(QUARTER_STAKING_AMOUNT, threeMonthsStakingPlanId);
        await ethers.provider.send('evm_increaseTime', [THREE_MONTHS_IN_SECONDS]);
        await ethers.provider.send('evm_mine');
        await expect(staking.connect(staker1).withdraw(stakeId)).to.not.be.reverted;
        const expectedStakeEarnings = calculateExpectedEarnings({
          stakingAmount: QUARTER_STAKING_AMOUNT,
          stakingPeriod: BigInt(THREE_MONTHS_IN_SECONDS),
          apy: BigInt(THREE_MONTHS_APY),
        });
        const stakeRecord = await staking.getStake(stakeId);
        expect(stakeRecord.earlyWithdrawal).to.equal(false);
        expect(stakeRecord.withdrawn).to.equal(true);
        expect(expectedStakeEarnings.expectedEarningsInTokens).to.eq(estimatedStakeEarnings.predictedEarningsInTokens);
        expect(expectedStakeEarnings.expectedEarningsPercentage).to.eq(
          estimatedStakeEarnings.predictedEarningsPercentage,
        );
        expect(stakeRecord.earningsInTokens).to.equal(expectedStakeEarnings.expectedEarningsInTokens);
        expect(stakeRecord.earningsPercentage).to.equal(expectedStakeEarnings.expectedEarningsPercentage);
        expect(stakeRecord.startTimestamp).to.equal(stakeRecord.endTimestamp - BigInt(THREE_MONTHS_IN_SECONDS));
      });

      it('should emit an event when withdrawing', async function () {
        const staker1Address = await staker1.getAddress();
        const stakeId = await staking.connect(staker1).stake.staticCall(QUARTER_STAKING_AMOUNT, threeMonthsStakingPlanId);
        await staking.connect(staker1).stake(QUARTER_STAKING_AMOUNT, threeMonthsStakingPlanId);
        await ethers.provider.send('evm_increaseTime', [THREE_MONTHS_IN_SECONDS]);
        await ethers.provider.send('evm_mine');
        await expect(staking.connect(staker1).withdraw(stakeId))
          .to.emit(staking, 'StakeWithdrawn')
          .withArgs(staker1Address, stakeId);
      });

      it('should allow to withdraw only initial stake if early withdrawal', async function () {
        let stakeRecord;

        const stakeId = await staking.connect(staker1).stake.staticCall(QUARTER_STAKING_AMOUNT, threeMonthsStakingPlanId);
        const currentBlock = await ethers.provider.getBlock('latest');
        const stakeTimestamp = currentBlock!.timestamp;
        await staking.connect(staker1).stake(QUARTER_STAKING_AMOUNT, threeMonthsStakingPlanId);
        stakeRecord = await staking.getStake(stakeId);
        const initialStakeEndTimestamp = stakeRecord.endTimestamp;
        await stakingManagement.connect(deployer).enableWithdraw();
        await ethers.provider.send('evm_increaseTime', [THREE_MONTHS_IN_SECONDS / 2]);
        await ethers.provider.send('evm_mine');
        const balanceBeforeWithdrawal = await stakingToken.balanceOf(await staker1.getAddress());
        await expect(staking.connect(staker1).withdraw(stakeId)).to.not.be.reverted;
        const balanceAfterWithdrawal = await stakingToken.balanceOf(await staker1.getAddress());
        stakeRecord = await staking.getStake(stakeId);
        expect(balanceAfterWithdrawal).to.equal(balanceBeforeWithdrawal + QUARTER_STAKING_AMOUNT);
        expect(stakeRecord.earlyWithdrawal).to.equal(true);
        expect(stakeRecord.earningsInTokens).to.equal(0n);
        expect(stakeRecord.earningsPercentage).to.equal(0n);
        expect(stakeRecord.withdrawn).to.equal(true);
        expect(stakeRecord.endTimestamp).to.be.gt(stakeTimestamp);
        expect(stakeRecord.endTimestamp).to.be.lt(initialStakeEndTimestamp);
      });

      it('should decrease the amount of stakes per plan once withdrawn', async function () {
        let stakesPerPlan;
        stakesPerPlan = await staking.getStakesAmountPerPlan(threeMonthsStakingPlanId);
        expect(stakesPerPlan).to.equal(0);
        const stakeId = await staking.connect(staker1).stake.staticCall(QUARTER_STAKING_AMOUNT, threeMonthsStakingPlanId);
        await staking.connect(staker1).stake(QUARTER_STAKING_AMOUNT, threeMonthsStakingPlanId);
        stakesPerPlan = await staking.getStakesAmountPerPlan(threeMonthsStakingPlanId);
        expect(stakesPerPlan).to.equal(1);
        await ethers.provider.send('evm_increaseTime', [THREE_MONTHS_IN_SECONDS]);
        await ethers.provider.send('evm_mine');
        await expect(staking.connect(staker1).withdraw(stakeId)).to.not.be.reverted;
        stakesPerPlan = await staking.getStakesAmountPerPlan(threeMonthsStakingPlanId);
        expect(stakesPerPlan).to.equal(0);
      });

      it('should revert when stake does not exist', async function () {
        await expect(staking.connect(staker1).withdraw(NON_EXISTING_STAKE_ID)).to.be.revertedWithCustomError(
          staking,
          'StakeDoesNotExist',
        );
      });

      it('should revert when stake is attempted to be withdrawn by stranger', async function () {
        const staker1Address = await staker1.getAddress();
        const stakeId = await staking.connect(staker1).stake.staticCall(QUARTER_STAKING_AMOUNT, threeMonthsStakingPlanId);
        await staking.connect(staker1).stake(QUARTER_STAKING_AMOUNT, threeMonthsStakingPlanId);
        await ethers.provider.send('evm_increaseTime', [THREE_MONTHS_IN_SECONDS]);
        await ethers.provider.send('evm_mine');
        await expect(staking.connect(stranger).withdraw(stakeId)).to.be.revertedWithCustomError(
          staking,
          'CallerIsNotStakeOwner',
        );
      });

      it('should revert when stake is already withdrawn', async function () {
        const stakeId = await staking.connect(staker1).stake.staticCall(QUARTER_STAKING_AMOUNT, threeMonthsStakingPlanId);
        await staking.connect(staker1).stake(QUARTER_STAKING_AMOUNT, threeMonthsStakingPlanId);
        await ethers.provider.send('evm_increaseTime', [THREE_MONTHS_IN_SECONDS]);
        await ethers.provider.send('evm_mine');
        await staking.connect(staker1).withdraw(stakeId);
        await expect(staking.connect(staker1).withdraw(stakeId)).to.be.revertedWithCustomError(
          staking,
          'StakeAlreadyWithdrawn',
        );
      });

      it('should revert when stake is not matured and early withdrawal disabled', async function () {
        const stakeId = await staking.connect(staker1).stake.staticCall(QUARTER_STAKING_AMOUNT, threeMonthsStakingPlanId);
        await staking.connect(staker1).stake(QUARTER_STAKING_AMOUNT, threeMonthsStakingPlanId);
        await expect(staking.connect(staker1).withdraw(stakeId)).to.be.revertedWithCustomError(
          staking,
          'EarlyWithdrawalNotAllowed',
        );
      });

      it('should revert when staking pool is empty', async function () {
        const stakingPoolAddress = await stakingPool.getAddress();
        const strangerAddress = await stranger.getAddress();
        const stakingPoolBalance = await stakingToken.balanceOf(stakingPoolAddress);
        const stakeId = await staking.connect(staker1).stake.staticCall(QUARTER_STAKING_AMOUNT, threeMonthsStakingPlanId);
        await staking.connect(staker1).stake(QUARTER_STAKING_AMOUNT, threeMonthsStakingPlanId);
        await ethers.provider.send('evm_increaseTime', [THREE_MONTHS_IN_SECONDS]);
        await ethers.provider.send('evm_mine');
        await stakingToken.connect(stakingPool).transfer(strangerAddress, stakingPoolBalance);
        await expect(staking.connect(staker1).withdraw(stakeId)).to.be.revertedWith(
          'ERC20: transfer amount exceeds balance',
        );
      });
    });
  });

  describe('View Functions', function () {
    /** APYs */
    const THREE_MONTHS_APY = 30_00;
    const SIX_MONTHS_APY = 50_00;
    const TWELVE_MONTHS_APY = 70_00;
    const TWENTY_FOUR_MONTHS_APY = 90_00;
    /** Time Frames */
    const THREE_MONTHS_IN_SECONDS = 7889238;
    const SIX_MONTHS_IN_SECONDS = 15778476;
    const TWELVE_MONTHS_IN_SECONDS = 31556952;
    const TWENTY_FOUR_MONTHS_IN_SECONDS = 63113904;
    /** Staking amounts */
    const STAKING_AMOUNT = ethers.parseEther('100');
    const QUARTER_STAKING_AMOUNT = ethers.parseEther('25');
    const NON_EXISTING_PLAN_ID = 999;
    const NON_EXISTING_STAKE_ID = 999;

    let threeMonthsStakingPlanId: BigNumberish;
    let sixMonthsStakingPlanId: BigNumberish;
    let twelveMonthsStakingPlanId: BigNumberish;
    let twentyFourMonthsStakingPlanId: BigNumberish;

    beforeEach(async function () {
      const staker1Address = await staker1.getAddress();
      const staker2Address = await staker2.getAddress();
      const staker3Address = await staker3.getAddress();
      const staker4Address = await staker4.getAddress();
      await stakingToken.connect(deployer).transfer(staker1Address, STAKING_AMOUNT);
      await stakingToken.connect(staker1).approve(staking.target, STAKING_AMOUNT);
      await stakingToken.connect(deployer).transfer(staker2Address, STAKING_AMOUNT);
      await stakingToken.connect(staker2).approve(staking.target, STAKING_AMOUNT);
      await stakingToken.connect(deployer).transfer(staker3Address, STAKING_AMOUNT);
      await stakingToken.connect(staker3).approve(staking.target, STAKING_AMOUNT);
      await stakingToken.connect(deployer).transfer(staker4Address, STAKING_AMOUNT);
      await stakingToken.connect(staker4).approve(staking.target, STAKING_AMOUNT);
      threeMonthsStakingPlanId = await stakingManagement
        .connect(stakingManager)
        .addStakingPlan.staticCall(THREE_MONTHS_IN_SECONDS, THREE_MONTHS_APY);
      await stakingManagement.connect(stakingManager).addStakingPlan(THREE_MONTHS_IN_SECONDS, THREE_MONTHS_APY);
      sixMonthsStakingPlanId = await stakingManagement
        .connect(stakingManager)
        .addStakingPlan.staticCall(SIX_MONTHS_IN_SECONDS, SIX_MONTHS_APY);
      await stakingManagement.connect(stakingManager).addStakingPlan(SIX_MONTHS_IN_SECONDS, SIX_MONTHS_APY);
      twelveMonthsStakingPlanId = await stakingManagement
        .connect(stakingManager)
        .addStakingPlan.staticCall(TWELVE_MONTHS_IN_SECONDS, TWELVE_MONTHS_APY);
      await stakingManagement.connect(stakingManager).addStakingPlan(TWELVE_MONTHS_IN_SECONDS, TWELVE_MONTHS_APY);
      twentyFourMonthsStakingPlanId = await stakingManagement
        .connect(stakingManager)
        .addStakingPlan.staticCall(TWENTY_FOUR_MONTHS_IN_SECONDS, TWENTY_FOUR_MONTHS_APY);
      await stakingManagement
        .connect(stakingManager)
        .addStakingPlan(TWENTY_FOUR_MONTHS_IN_SECONDS, TWENTY_FOUR_MONTHS_APY);
      await stakingManagement.connect(stakingManager).setStakingLimits(QUARTER_STAKING_AMOUNT, QUARTER_STAKING_AMOUNT);
    });

    describe('getStakingPlan', function () {
      it('should return the correct staking plan', async function () {
        const oneMonthStakingPlan = await stakingManagement.getStakingPlan(threeMonthsStakingPlanId);
        expect(oneMonthStakingPlan.duration).to.equal(THREE_MONTHS_IN_SECONDS);
        expect(oneMonthStakingPlan.apy).to.equal(THREE_MONTHS_APY);
      });

      it('should revert when staking plan does not exist', async function () {
        await expect(stakingManagement.getStakingPlan(NON_EXISTING_PLAN_ID)).to.be.revertedWithCustomError(
          stakingManagement,
          'StakingPlanDoesNotExist',
        );
      });
    });

    describe('getStake', function () {
      it('should return the correct stake', async function () {
        const staker1Address = await staker1.getAddress();
        const stakeId = await staking.connect(staker1).stake.staticCall(QUARTER_STAKING_AMOUNT, threeMonthsStakingPlanId);
        await staking.connect(staker1).stake(QUARTER_STAKING_AMOUNT, threeMonthsStakingPlanId);
        const stake = await staking.getStake(stakeId);
        expect(stake.staker).to.equal(staker1Address);
        expect(stake.amount).to.equal(QUARTER_STAKING_AMOUNT);
        expect(stake.stakingPlanId).to.equal(threeMonthsStakingPlanId);
        expect(stake.earningsInTokens).to.equal(0n);
        expect(stake.earningsPercentage).to.equal(0n);
        expect(stake.earlyWithdrawal).to.equal(false);
        expect(stake.withdrawn).to.equal(false);
      });

      it('should revert when stake does not exist', async function () {
        await expect(staking.getStake(NON_EXISTING_STAKE_ID)).to.be.revertedWithCustomError(
          staking,
          'StakeDoesNotExist',
        );
      });
    });

    describe('calculateStakeEarnings', function () {
      it('should return the correct stake earnings after staking period is over', async function () {
        const stakeId = await staking.connect(staker1).stake.staticCall(QUARTER_STAKING_AMOUNT, threeMonthsStakingPlanId);
        await staking.connect(staker1).stake(QUARTER_STAKING_AMOUNT, threeMonthsStakingPlanId);
        await ethers.provider.send('evm_increaseTime', [THREE_MONTHS_IN_SECONDS]);
        await ethers.provider.send('evm_mine');
        const stakeEarnings = await staking.calculateStakeEarnings(stakeId);
        const expectedStakeEarnings = calculateExpectedEarnings({
          stakingAmount: QUARTER_STAKING_AMOUNT,
          stakingPeriod: BigInt(THREE_MONTHS_IN_SECONDS),
          apy: BigInt(THREE_MONTHS_APY),
        });

        console.log('REAL EARNINGS: ', stakeEarnings);
        console.log('EXPECTED EARNINGS: ', expectedStakeEarnings);

        expect(stakeEarnings.earningsInTokens).to.equal(expectedStakeEarnings.expectedEarningsInTokens);
        expect(stakeEarnings.earningsPercentage).to.equal(expectedStakeEarnings.expectedEarningsPercentage);
      });

      it('should return the correct amount during staking period', async function () {
        const stakeId = await staking.connect(staker1).stake.staticCall(QUARTER_STAKING_AMOUNT, threeMonthsStakingPlanId);
        await staking.connect(staker1).stake(QUARTER_STAKING_AMOUNT, threeMonthsStakingPlanId);
        await ethers.provider.send('evm_increaseTime', [THREE_MONTHS_IN_SECONDS / 2]);
        await ethers.provider.send('evm_mine');
        const stakeEarnings = await staking.calculateStakeEarnings(stakeId);
        const expectedStakeEarnings = calculateExpectedEarnings({
          stakingAmount: QUARTER_STAKING_AMOUNT,
          stakingPeriod: BigInt(THREE_MONTHS_IN_SECONDS / 2),
          apy: BigInt(THREE_MONTHS_APY),
        });
        expect(stakeEarnings.earningsInTokens).to.equal(expectedStakeEarnings.expectedEarningsInTokens);
        expect(stakeEarnings.earningsPercentage).to.equal(expectedStakeEarnings.expectedEarningsPercentage);
      });

      it('should revert when stake does not exist', async function () {
        await expect(staking.calculateStakeEarnings(NON_EXISTING_STAKE_ID)).to.be.revertedWithCustomError(
          staking,
          'StakeDoesNotExist',
        );
      });
    });

    describe('simulateStakeEarnings', function () {
      it('should return the correct stake earnings before stake is ready', async function () {
        const stakeId = await staking.connect(staker1).stake.staticCall(QUARTER_STAKING_AMOUNT, threeMonthsStakingPlanId);
        await staking.connect(staker1).stake(QUARTER_STAKING_AMOUNT, threeMonthsStakingPlanId);
        const timestampNow = await ethers.provider.getBlock('latest').then((block) => block!.timestamp);
        const testTimestamp = timestampNow + THREE_MONTHS_IN_SECONDS;
        const simulatedStakeEarnings = await staking.simulateStakeEarnings(stakeId, testTimestamp);

        const expectedStakeEarnings = calculateExpectedEarnings({
          stakingAmount: QUARTER_STAKING_AMOUNT,
          stakingPeriod: BigInt(THREE_MONTHS_IN_SECONDS),
          apy: BigInt(THREE_MONTHS_APY),
        });

        console.log('EXPECTED EARNINGS: ', expectedStakeEarnings);

        expect(simulatedStakeEarnings.earningsInTokens).to.equal(expectedStakeEarnings.expectedEarningsInTokens);
        expect(simulatedStakeEarnings.earningsPercentage).to.equal(expectedStakeEarnings.expectedEarningsPercentage);
      });
    });

    describe('estimateStakeEarnings', function () {
      it('should estimate the correct amount for 1m and 10% APY', async function () {
        const estimatedEarnings = await staking.estimateStakeEarnings(QUARTER_STAKING_AMOUNT, threeMonthsStakingPlanId);
        const stakeId = await staking.connect(staker1).stake.staticCall(QUARTER_STAKING_AMOUNT, threeMonthsStakingPlanId);
        await staking.connect(staker1).stake(QUARTER_STAKING_AMOUNT, threeMonthsStakingPlanId);
        await ethers.provider.send('evm_increaseTime', [THREE_MONTHS_IN_SECONDS]);
        await ethers.provider.send('evm_mine');
        await expect(staking.connect(staker1).withdraw(stakeId)).to.not.be.reverted;
        const expectedStakeEarnings = calculateExpectedEarnings({
          stakingAmount: QUARTER_STAKING_AMOUNT,
          stakingPeriod: BigInt(THREE_MONTHS_IN_SECONDS),
          apy: BigInt(THREE_MONTHS_APY),
        });
        const stakeRecord = await staking.getStake(stakeId);
        expect(estimatedEarnings.predictedEarningsInTokens).to.equal(expectedStakeEarnings.expectedEarningsInTokens);
        expect(estimatedEarnings.predictedEarningsPercentage).to.equal(
          expectedStakeEarnings.expectedEarningsPercentage,
        );
        expect(stakeRecord.earningsInTokens).to.equal(estimatedEarnings.predictedEarningsInTokens);
        expect(stakeRecord.earningsPercentage).to.equal(estimatedEarnings.predictedEarningsPercentage);
      });

      it('should estimate the correct amount for 3m and 12% APY', async function () {
        const estimatedEarnings = await staking.estimateStakeEarnings(QUARTER_STAKING_AMOUNT, sixMonthsStakingPlanId);
        const stakeId = await staking
          .connect(staker1)
          .stake.staticCall(QUARTER_STAKING_AMOUNT, sixMonthsStakingPlanId);
        await staking.connect(staker1).stake(QUARTER_STAKING_AMOUNT, sixMonthsStakingPlanId);
        await ethers.provider.send('evm_increaseTime', [SIX_MONTHS_IN_SECONDS]);
        await ethers.provider.send('evm_mine');
        await expect(staking.connect(staker1).withdraw(stakeId)).to.not.be.reverted;
        const expectedStakeEarnings = calculateExpectedEarnings({
          stakingAmount: QUARTER_STAKING_AMOUNT,
          stakingPeriod: BigInt(SIX_MONTHS_IN_SECONDS),
          apy: BigInt(SIX_MONTHS_APY),
        });
        const stakeRecord = await staking.getStake(stakeId);
        expect(estimatedEarnings.predictedEarningsInTokens).to.equal(expectedStakeEarnings.expectedEarningsInTokens);
        expect(estimatedEarnings.predictedEarningsPercentage).to.equal(
          expectedStakeEarnings.expectedEarningsPercentage,
        );
        expect(stakeRecord.earningsInTokens).to.equal(estimatedEarnings.predictedEarningsInTokens);
        expect(stakeRecord.earningsPercentage).to.equal(estimatedEarnings.predictedEarningsPercentage);
      });

      it('should estimate the correct amount for 6m and 14% APY', async function () {
        const estimatedEarnings = await staking.estimateStakeEarnings(QUARTER_STAKING_AMOUNT, twelveMonthsStakingPlanId);
        const stakeId = await staking.connect(staker1).stake.staticCall(QUARTER_STAKING_AMOUNT, twelveMonthsStakingPlanId);
        await staking.connect(staker1).stake(QUARTER_STAKING_AMOUNT, twelveMonthsStakingPlanId);
        await ethers.provider.send('evm_increaseTime', [TWELVE_MONTHS_IN_SECONDS]);
        await ethers.provider.send('evm_mine');
        await expect(staking.connect(staker1).withdraw(stakeId)).to.not.be.reverted;
        const expectedStakeEarnings = calculateExpectedEarnings({
          stakingAmount: QUARTER_STAKING_AMOUNT,
          stakingPeriod: BigInt(TWELVE_MONTHS_IN_SECONDS),
          apy: BigInt(TWELVE_MONTHS_APY),
        });
        const stakeRecord = await staking.getStake(stakeId);
        expect(estimatedEarnings.predictedEarningsInTokens).to.equal(expectedStakeEarnings.expectedEarningsInTokens);
        expect(estimatedEarnings.predictedEarningsPercentage).to.equal(
          expectedStakeEarnings.expectedEarningsPercentage,
        );
        expect(stakeRecord.earningsInTokens).to.equal(estimatedEarnings.predictedEarningsInTokens);
        expect(stakeRecord.earningsPercentage).to.equal(estimatedEarnings.predictedEarningsPercentage);
      });

      it('should estimate the correct amount for 12m and 18% APY', async function () {
        const estimatedEarnings = await staking.estimateStakeEarnings(
          QUARTER_STAKING_AMOUNT,
          twentyFourMonthsStakingPlanId,
        );
        const stakeId = await staking
          .connect(staker1)
          .stake.staticCall(QUARTER_STAKING_AMOUNT, twentyFourMonthsStakingPlanId);
        await staking.connect(staker1).stake(QUARTER_STAKING_AMOUNT, twentyFourMonthsStakingPlanId);
        await ethers.provider.send('evm_increaseTime', [TWENTY_FOUR_MONTHS_IN_SECONDS]);
        await ethers.provider.send('evm_mine');
        await expect(staking.connect(staker1).withdraw(stakeId)).to.not.be.reverted;
        const expectedStakeEarnings = calculateExpectedEarnings({
          stakingAmount: QUARTER_STAKING_AMOUNT,
          stakingPeriod: BigInt(TWENTY_FOUR_MONTHS_IN_SECONDS),
          apy: BigInt(TWENTY_FOUR_MONTHS_APY),
        });
        const stakeRecord = await staking.getStake(stakeId);
        expect(estimatedEarnings.predictedEarningsInTokens).to.equal(expectedStakeEarnings.expectedEarningsInTokens);
        expect(estimatedEarnings.predictedEarningsPercentage).to.equal(
          expectedStakeEarnings.expectedEarningsPercentage,
        );
        expect(stakeRecord.earningsInTokens).to.equal(estimatedEarnings.predictedEarningsInTokens);
        expect(stakeRecord.earningsPercentage).to.equal(estimatedEarnings.predictedEarningsPercentage);
      });

      it('should return 0 if the amount if zero', async function () {
        const estimatedEarnings = await staking.estimateStakeEarnings(ZERO_AMOUNT, threeMonthsStakingPlanId);
        expect(estimatedEarnings.predictedEarningsInTokens).to.equal(0);
        expect(estimatedEarnings.predictedEarningsPercentage).to.equal(0);
      });

      it('should revert if the staking plan does not exist', async function () {
        await expect(
          staking.estimateStakeEarnings(QUARTER_STAKING_AMOUNT, NON_EXISTING_PLAN_ID),
        ).to.be.revertedWithCustomError(stakingManagement, 'StakingPlanDoesNotExist');
      });

      it('should revert when stake does not exist', async function () {
        await expect(staking.calculateStakeEarnings(NON_EXISTING_STAKE_ID)).to.be.revertedWithCustomError(
          staking,
          'StakeDoesNotExist',
        );
      });
    });

    describe('getStakes', function () {
      it('should return empty array if 0 offset and 0 limit', async function () {
        const staker1Address = await staker1.getAddress();
        const allStakerStakes = await staking.getStakes(staker1Address, 0, 0);
        expect(allStakerStakes.length).to.equal(0);
      });

      it('should return empty array if staker has no stakes', async function () {
        const staker1Address = await staker1.getAddress();
        const allStakerStakes = await staking.getStakes(staker1Address, 0, 100);
        expect(allStakerStakes.length).to.equal(0);
      });

      it('should return all stakes for a staker', async function () {
        const staker1Address = await staker1.getAddress();
        await staking.connect(staker1).stake(QUARTER_STAKING_AMOUNT, threeMonthsStakingPlanId);
        await staking.connect(staker1).stake(QUARTER_STAKING_AMOUNT, sixMonthsStakingPlanId);
        await staking.connect(staker1).stake(QUARTER_STAKING_AMOUNT, twelveMonthsStakingPlanId);
        await staking.connect(staker1).stake(QUARTER_STAKING_AMOUNT, twentyFourMonthsStakingPlanId);

        const allStakerStakes = await staking.getStakes(staker1Address, 0, 4);
        expect(allStakerStakes.length).to.equal(4);
      });

      it('should return correct amount with offset', async function () {
        const staker1Address = await staker1.getAddress();
        await staking.connect(staker1).stake(QUARTER_STAKING_AMOUNT, threeMonthsStakingPlanId);
        await staking.connect(staker1).stake(QUARTER_STAKING_AMOUNT, sixMonthsStakingPlanId);
        await staking.connect(staker1).stake(QUARTER_STAKING_AMOUNT, twelveMonthsStakingPlanId);
        await staking.connect(staker1).stake(QUARTER_STAKING_AMOUNT, twentyFourMonthsStakingPlanId);

        const allStakerStakes = await staking.getStakes(staker1Address, 2, 4);
        expect(allStakerStakes.length).to.equal(2);
      });
    });

    describe('getAllStakes', function () {
      it('should return empty array if 0 offset and 0 limit', async function () {
        const allStakerStakes = await staking.getAllStakes(0, 0);
        expect(allStakerStakes.length).to.equal(0);
      });

      it('should return empty array if 0 offset and 0 limit', async function () {
        const allStakerStakes = await staking.getAllStakes(0, 100);
        expect(allStakerStakes.length).to.equal(0);
      });

      it('should return all stakes', async function () {
        await staking.connect(staker1).stake(QUARTER_STAKING_AMOUNT, threeMonthsStakingPlanId);
        await staking.connect(staker1).stake(QUARTER_STAKING_AMOUNT, sixMonthsStakingPlanId);
        await staking.connect(staker1).stake(QUARTER_STAKING_AMOUNT, twelveMonthsStakingPlanId);
        await staking.connect(staker1).stake(QUARTER_STAKING_AMOUNT, twentyFourMonthsStakingPlanId);
        await staking.connect(staker2).stake(QUARTER_STAKING_AMOUNT, threeMonthsStakingPlanId);
        await staking.connect(staker2).stake(QUARTER_STAKING_AMOUNT, sixMonthsStakingPlanId);
        await staking.connect(staker2).stake(QUARTER_STAKING_AMOUNT, twelveMonthsStakingPlanId);
        await staking.connect(staker2).stake(QUARTER_STAKING_AMOUNT, twentyFourMonthsStakingPlanId);
        await staking.connect(staker3).stake(QUARTER_STAKING_AMOUNT, threeMonthsStakingPlanId);
        await staking.connect(staker3).stake(QUARTER_STAKING_AMOUNT, sixMonthsStakingPlanId);
        await staking.connect(staker3).stake(QUARTER_STAKING_AMOUNT, twelveMonthsStakingPlanId);
        await staking.connect(staker3).stake(QUARTER_STAKING_AMOUNT, twentyFourMonthsStakingPlanId);
        const allStakes = await staking.getAllStakes(0, 12);
        expect(allStakes.length).to.equal(12);
      });

      it('should return correct amount with offset', async function () {
        await staking.connect(staker1).stake(QUARTER_STAKING_AMOUNT, threeMonthsStakingPlanId);
        await staking.connect(staker1).stake(QUARTER_STAKING_AMOUNT, sixMonthsStakingPlanId);
        await staking.connect(staker1).stake(QUARTER_STAKING_AMOUNT, twelveMonthsStakingPlanId);
        await staking.connect(staker1).stake(QUARTER_STAKING_AMOUNT, twentyFourMonthsStakingPlanId);
        await staking.connect(staker2).stake(QUARTER_STAKING_AMOUNT, threeMonthsStakingPlanId);
        await staking.connect(staker2).stake(QUARTER_STAKING_AMOUNT, sixMonthsStakingPlanId);
        await staking.connect(staker2).stake(QUARTER_STAKING_AMOUNT, twelveMonthsStakingPlanId);
        await staking.connect(staker2).stake(QUARTER_STAKING_AMOUNT, twentyFourMonthsStakingPlanId);
        await staking.connect(staker3).stake(QUARTER_STAKING_AMOUNT, threeMonthsStakingPlanId);
        await staking.connect(staker3).stake(QUARTER_STAKING_AMOUNT, sixMonthsStakingPlanId);
        await staking.connect(staker3).stake(QUARTER_STAKING_AMOUNT, twelveMonthsStakingPlanId);
        await staking.connect(staker3).stake(QUARTER_STAKING_AMOUNT, twentyFourMonthsStakingPlanId);
        const allStakes = await staking.getAllStakes(6, 12);
        expect(allStakes.length).to.equal(6);
      });
    });

    describe('getStakesCount', function () {
      it('should return the correct amount if staker has stakes', async function () {
        const staker1Address = await staker1.getAddress();
        await staking.connect(staker1).stake(QUARTER_STAKING_AMOUNT, threeMonthsStakingPlanId);
        await staking.connect(staker1).stake(QUARTER_STAKING_AMOUNT, sixMonthsStakingPlanId);
        await staking.connect(staker1).stake(QUARTER_STAKING_AMOUNT, twelveMonthsStakingPlanId);
        await staking.connect(staker1).stake(QUARTER_STAKING_AMOUNT, twentyFourMonthsStakingPlanId);

        const stakesCount = await staking.getStakesCount(staker1Address);
        expect(stakesCount).to.equal(4);
      });

      it('should return the correct amount if staker has no stakes', async function () {
        const staker1Address = await staker1.getAddress();
        const stakesCount = await staking.getStakesCount(staker1Address);
        expect(stakesCount).to.equal(0);
      });
    });

    describe('getAllStakesCount', function () {
      it('should return the correct amount if there are any stakes', async function () {
        await staking.connect(staker1).stake(QUARTER_STAKING_AMOUNT, threeMonthsStakingPlanId);
        await staking.connect(staker1).stake(QUARTER_STAKING_AMOUNT, sixMonthsStakingPlanId);
        await staking.connect(staker1).stake(QUARTER_STAKING_AMOUNT, twelveMonthsStakingPlanId);
        await staking.connect(staker1).stake(QUARTER_STAKING_AMOUNT, twentyFourMonthsStakingPlanId);

        const allStakesCount = await staking.getAllStakesCount();
        expect(allStakesCount).to.equal(4);
      });

      it('should return the correct amount if there is no stakes', async function () {
        const allStakesCount = await staking.getAllStakesCount();
        expect(allStakesCount).to.equal(0);
      });
    });

    describe('getStakeIds', function () {
      it('should return the correct ids if staker has any stakes', async function () {
        const staker1Address = await staker1.getAddress();
        const firstStakeId = await staking
          .connect(staker1)
          .stake.staticCall(QUARTER_STAKING_AMOUNT, threeMonthsStakingPlanId);
        await staking.connect(staker1).stake(QUARTER_STAKING_AMOUNT, threeMonthsStakingPlanId);
        const secondStakeId = await staking
          .connect(staker1)
          .stake.staticCall(QUARTER_STAKING_AMOUNT, sixMonthsStakingPlanId);
        await staking.connect(staker1).stake(QUARTER_STAKING_AMOUNT, sixMonthsStakingPlanId);
        const thirdStakeId = await staking
          .connect(staker1)
          .stake.staticCall(QUARTER_STAKING_AMOUNT, twelveMonthsStakingPlanId);
        await staking.connect(staker1).stake(QUARTER_STAKING_AMOUNT, twelveMonthsStakingPlanId);
        const fourthStakeId = await staking
          .connect(staker1)
          .stake.staticCall(QUARTER_STAKING_AMOUNT, twentyFourMonthsStakingPlanId);
        await staking.connect(staker1).stake(QUARTER_STAKING_AMOUNT, twentyFourMonthsStakingPlanId);

        const stakeIds = await staking.getStakeIds(staker1Address);
        expect(stakeIds).to.have.lengthOf(4);
        expect(stakeIds[0]).to.equal(firstStakeId);
        expect(stakeIds[1]).to.equal(secondStakeId);
        expect(stakeIds[2]).to.equal(thirdStakeId);
        expect(stakeIds[3]).to.equal(fourthStakeId);
      });

      it('should return the empty array if staker has no stakes', async function () {
        const staker1Address = await staker1.getAddress();

        const stakeIds = await staking.getStakeIds(staker1Address);
        expect(stakeIds).to.have.lengthOf(0);
      });
    });

    describe('getAllStakeIds', function () {
      it('should return the correct ids if there are any stakes', async function () {
        const firstStakeId = await staking
          .connect(staker1)
          .stake.staticCall(QUARTER_STAKING_AMOUNT, threeMonthsStakingPlanId);
        await staking.connect(staker1).stake(QUARTER_STAKING_AMOUNT, threeMonthsStakingPlanId);
        const secondStakeId = await staking
          .connect(staker2)
          .stake.staticCall(QUARTER_STAKING_AMOUNT, sixMonthsStakingPlanId);
        await staking.connect(staker2).stake(QUARTER_STAKING_AMOUNT, sixMonthsStakingPlanId);
        const thirdStakeId = await staking
          .connect(staker3)
          .stake.staticCall(QUARTER_STAKING_AMOUNT, twelveMonthsStakingPlanId);
        await staking.connect(staker3).stake(QUARTER_STAKING_AMOUNT, twelveMonthsStakingPlanId);

        const stakeIds = await staking.getAllStakeIds();
        expect(stakeIds).to.have.lengthOf(3);
        expect(stakeIds[0]).to.equal(firstStakeId);
        expect(stakeIds[1]).to.equal(secondStakeId);
        expect(stakeIds[2]).to.equal(thirdStakeId);
      });

      it('should return the empty array if no stakes', async function () {
        const stakeIds = await staking.getAllStakeIds();
        expect(stakeIds).to.have.lengthOf(0);
      });
    });

    describe('getStakedAmount', function () {
      it('should return the correct amount for all staker stakes and stake plans', async function () {
        const staker1Address = await staker1.getAddress();
        await staking.connect(staker1).stake(QUARTER_STAKING_AMOUNT, threeMonthsStakingPlanId);
        await staking.connect(staker1).stake(QUARTER_STAKING_AMOUNT, sixMonthsStakingPlanId);
        await staking.connect(staker1).stake(QUARTER_STAKING_AMOUNT, twelveMonthsStakingPlanId);
        await staking.connect(staker1).stake(QUARTER_STAKING_AMOUNT, twentyFourMonthsStakingPlanId);

        const stakedAmount = await staking.getStakedAmount(staker1Address);
        expect(stakedAmount).to.be.eq(STAKING_AMOUNT);
      });

      it('should return the correct amount if user has no stakes', async function () {
        const staker1Address = await staker1.getAddress();

        const stakedAmount = await staking.getStakedAmount(staker1Address);
        expect(stakedAmount).to.be.eq(ZERO_AMOUNT);
      });
    });

    describe('getTotalTokensStaked', function () {
      it('should return correct amount if any stakes', async function () {
        await staking.connect(staker1).stake(QUARTER_STAKING_AMOUNT, threeMonthsStakingPlanId);
        await staking.connect(staker2).stake(QUARTER_STAKING_AMOUNT, sixMonthsStakingPlanId);
        await staking.connect(staker3).stake(QUARTER_STAKING_AMOUNT, twelveMonthsStakingPlanId);
        await staking.connect(staker4).stake(QUARTER_STAKING_AMOUNT, twentyFourMonthsStakingPlanId);

        const totalStaked = await staking.getTotalTokensStaked();
        expect(totalStaked).to.be.eq(STAKING_AMOUNT);
      });

      it('should return correct amount if no stakes', async function () {
        const totalStaked = await staking.getTotalTokensStaked();
        expect(totalStaked).to.be.eq(0);
      });
    });

    describe('calculateTotalEarnings', function () {
      it('should return the correct amount if staker has any stakes', async function () {
        const staker1Address = await staker1.getAddress();
        const firstStakeId = await staking.connect(staker1).stake.staticCall(QUARTER_STAKING_AMOUNT, threeMonthsStakingPlanId);
        await staking.connect(staker1).stake(QUARTER_STAKING_AMOUNT, threeMonthsStakingPlanId);
        const secondStakeId = await staking.connect(staker1).stake.staticCall(QUARTER_STAKING_AMOUNT, sixMonthsStakingPlanId);
        await staking.connect(staker1).stake(QUARTER_STAKING_AMOUNT, sixMonthsStakingPlanId);
        const thirdStakeId = await staking.connect(staker1).stake.staticCall(QUARTER_STAKING_AMOUNT, twelveMonthsStakingPlanId);
        await staking.connect(staker1).stake(QUARTER_STAKING_AMOUNT, twelveMonthsStakingPlanId);
        const fourthStakeId = await staking.connect(staker1).stake.staticCall(QUARTER_STAKING_AMOUNT, twentyFourMonthsStakingPlanId);
        await staking.connect(staker1).stake(QUARTER_STAKING_AMOUNT, twentyFourMonthsStakingPlanId);

        let stakeEarnings = await staking.calculateStakeEarnings(firstStakeId);
        let totalEarnings = await staking.calculateTotalEarnings(staker1Address);

        await ethers.provider.send('evm_increaseTime', [THREE_MONTHS_IN_SECONDS]);
        await ethers.provider.send('evm_mine');

        console.log('3 MONTHS PASSED');
        stakeEarnings = await staking.calculateStakeEarnings(firstStakeId);
        console.log('STAKE EARNINGS: ', stakeEarnings);
        totalEarnings = await staking.calculateTotalEarnings(staker1Address);
        console.log('TOTAL EARNIGNS: ', totalEarnings);

        await ethers.provider.send('evm_increaseTime', [THREE_MONTHS_IN_SECONDS]);
        await ethers.provider.send('evm_mine');

        console.log('6 MONTHS PASSED');
        stakeEarnings = await staking.calculateStakeEarnings(firstStakeId);
        console.log('STAKE EARNINGS: ', stakeEarnings);
        totalEarnings = await staking.calculateTotalEarnings(staker1Address);
        console.log('TOTAL EARNIGNS: ', totalEarnings);

        await ethers.provider.send('evm_increaseTime', [SIX_MONTHS_IN_SECONDS]);
        await ethers.provider.send('evm_mine');

        console.log('12 MONTHS PASSED');
        stakeEarnings = await staking.calculateStakeEarnings(firstStakeId);
        console.log('STAKE EARNINGS: ', stakeEarnings);
        totalEarnings = await staking.calculateTotalEarnings(staker1Address);
        console.log('TOTAL EARNIGNS: ', totalEarnings);

        await ethers.provider.send('evm_increaseTime', [TWELVE_MONTHS_IN_SECONDS]);
        await ethers.provider.send('evm_mine');

        console.log('24 MONTHS PASSED');

        const threeMonthsStakeEarnings = await staking.calculateStakeEarnings(firstStakeId);
        const sixMonthsStakeEarnings = await staking.calculateStakeEarnings(secondStakeId);
        const twelveMonthsStakeEarnings = await staking.calculateStakeEarnings(thirdStakeId);
        const twoYearsStakeEarnings = await staking.calculateStakeEarnings(fourthStakeId);

        console.log('3M STAKE EARNINGS: ', threeMonthsStakeEarnings);
        console.log('6M STAKE EARNINGS: ', sixMonthsStakeEarnings);
        console.log('12M STAKE EARNINGS: ', twelveMonthsStakeEarnings);
        console.log('2Y STAKE EARNINGS: ', twoYearsStakeEarnings);
        totalEarnings = await staking.calculateTotalEarnings(staker1Address);
        console.log('TOTAL EARNIGNS: ', totalEarnings);

        const expectedTotalEarnings = calculateTotalExpectedEarnings([
          { stakingAmount: QUARTER_STAKING_AMOUNT, stakingPeriod: BigInt(THREE_MONTHS_IN_SECONDS), apy: BigInt(THREE_MONTHS_APY) },
          { stakingAmount: QUARTER_STAKING_AMOUNT, stakingPeriod: BigInt(SIX_MONTHS_IN_SECONDS), apy: BigInt(SIX_MONTHS_APY) },
          { stakingAmount: QUARTER_STAKING_AMOUNT, stakingPeriod: BigInt(TWELVE_MONTHS_IN_SECONDS), apy: BigInt(TWELVE_MONTHS_APY) },
          { stakingAmount: QUARTER_STAKING_AMOUNT, stakingPeriod: BigInt(TWENTY_FOUR_MONTHS_IN_SECONDS), apy: BigInt(TWENTY_FOUR_MONTHS_APY) },
        ])

        expect(totalEarnings.totalEarningsInTokens).to.be.eq(expectedTotalEarnings.expectedEarningsInTokens);
        expect(totalEarnings.totalEarningsPercentage).to.be.eq(expectedTotalEarnings.expectedEarningsPercentage);
      });

      it('should return the correct amount if staker has no stakes', async function () {
        const staker1Address = await staker1.getAddress();
        const totalEarnings = await staking.calculateTotalEarnings(staker1Address);
        expect(totalEarnings.totalEarningsInTokens).to.be.eq(0);
        expect(totalEarnings.totalEarningsPercentage).to.be.eq(0);
      });
    });

    describe('isStakeExists', function () {
      it('should return true for existing stake', async function () {
        const stakeId = await staking.connect(staker1).stake.staticCall(QUARTER_STAKING_AMOUNT, threeMonthsStakingPlanId);
        await staking.connect(staker1).stake(QUARTER_STAKING_AMOUNT, threeMonthsStakingPlanId);
        const isStakeExists = await staking.isStakeExists(stakeId);
        expect(isStakeExists).to.be.true;
      });

      it('should return false for non-existing stake', async function () {
        const isStakeExists = await staking.isStakeExists(NON_EXISTING_STAKE_ID);
        expect(isStakeExists).to.be.false;
      });
    });

    describe('getStakesAmountPerPlan', function () {
      it('should return the correct amount for every plan', async function () {
        await staking.connect(staker1).stake(QUARTER_STAKING_AMOUNT, threeMonthsStakingPlanId);
        await staking.connect(staker1).stake(QUARTER_STAKING_AMOUNT, sixMonthsStakingPlanId);
        await staking.connect(staker1).stake(QUARTER_STAKING_AMOUNT, twelveMonthsStakingPlanId);
        await staking.connect(staker1).stake(QUARTER_STAKING_AMOUNT, twentyFourMonthsStakingPlanId);

        const firstPlanStakesAmount = await staking.getStakesAmountPerPlan(threeMonthsStakingPlanId);
        const secondPlanStakesAmount = await staking.getStakesAmountPerPlan(sixMonthsStakingPlanId);
        const thirdPlanStakesAmount = await staking.getStakesAmountPerPlan(twelveMonthsStakingPlanId);
        const fourthPlanStakesAmount = await staking.getStakesAmountPerPlan(twentyFourMonthsStakingPlanId);

        expect(firstPlanStakesAmount).to.be.eq(1);
        expect(secondPlanStakesAmount).to.be.eq(1);
        expect(thirdPlanStakesAmount).to.be.eq(1);
        expect(fourthPlanStakesAmount).to.be.eq(1);
      });

      it('should revert if plan does not exist', async function () {
        await expect(staking.getStakesAmountPerPlan(NON_EXISTING_PLAN_ID)).to.be.revertedWithCustomError(
          stakingManagement,
          'StakingPlanDoesNotExist',
        );
      });
    });

    describe('getStakesPerPlan', function () {
      it('should return the correct stake data for every plan', async function () {
        await staking.connect(staker1).stake(QUARTER_STAKING_AMOUNT, threeMonthsStakingPlanId);
        await staking.connect(staker1).stake(QUARTER_STAKING_AMOUNT, sixMonthsStakingPlanId);
        await staking.connect(staker1).stake(QUARTER_STAKING_AMOUNT, twelveMonthsStakingPlanId);
        await staking.connect(staker1).stake(QUARTER_STAKING_AMOUNT, twentyFourMonthsStakingPlanId);

        const firstPlanStakes = await staking.getStakesPerPlan(threeMonthsStakingPlanId, 0, 100);
        const secondPlanStakes = await staking.getStakesPerPlan(sixMonthsStakingPlanId, 0, 100);
        const thirdPlanStakes = await staking.getStakesPerPlan(twelveMonthsStakingPlanId, 0, 100);
        const fourthPlanStakes = await staking.getStakesPerPlan(twentyFourMonthsStakingPlanId, 0, 100);

        expect(firstPlanStakes).to.have.lengthOf(1);
        expect(secondPlanStakes).to.have.lengthOf(1);
        expect(thirdPlanStakes).to.have.lengthOf(1);
        expect(fourthPlanStakes).to.have.lengthOf(1);
      });

      it('should revert if plan does not exist', async function () {
        await expect(staking.getStakesAmountPerPlan(NON_EXISTING_PLAN_ID)).to.be.revertedWithCustomError(
          stakingManagement,
          'StakingPlanDoesNotExist',
        );
      });
    });

    describe('getTotalTokensStaked', function () {
      it('should return the correct total staked after a couple of stakes', async function () {
        const stake1EsimatedEarnings = await staking.estimateStakeEarnings(
          QUARTER_STAKING_AMOUNT,
          threeMonthsStakingPlanId,
        );
        const stake2EsimatedEarnings = await staking.estimateStakeEarnings(
          QUARTER_STAKING_AMOUNT,
          sixMonthsStakingPlanId,
        );
        const stake3EsimatedEarnings = await staking.estimateStakeEarnings(
          QUARTER_STAKING_AMOUNT,
          twelveMonthsStakingPlanId,
        );
        const stake4EsimatedEarnings = await staking.estimateStakeEarnings(
          QUARTER_STAKING_AMOUNT,
          twentyFourMonthsStakingPlanId,
        );

        await staking.connect(staker1).stake(QUARTER_STAKING_AMOUNT, threeMonthsStakingPlanId);
        await staking.connect(staker1).stake(QUARTER_STAKING_AMOUNT, sixMonthsStakingPlanId);
        await staking.connect(staker1).stake(QUARTER_STAKING_AMOUNT, twelveMonthsStakingPlanId);
        await staking.connect(staker1).stake(QUARTER_STAKING_AMOUNT, twentyFourMonthsStakingPlanId);

        const expectedTotalStaked = STAKING_AMOUNT;
        const totalStaked = await staking.getTotalTokensStaked();

        expect(totalStaked).to.be.eq(expectedTotalStaked);
      });

      it('should return zero if no stakes', async function () {
        const totalStaked = await staking.getTotalTokensStaked();
        expect(totalStaked).to.be.eq(0);
      });
    });

    describe('getRewardPoolSize', function () {
      it('should return the correct pool size amount', async function () {
        const rewardPoolSize = await staking.getRewardPoolSize();
        expect(rewardPoolSize).to.be.eq(STAKING_REWARD_POOL_SIZE);
      });

      it('should return the correct pool size after a change', async function () {
        let stakingPoolSize = await staking.getRewardPoolSize();
        expect(stakingPoolSize).to.be.eq(STAKING_REWARD_POOL_SIZE);

        const NEW_STAKING_REWARD_POOL_SIZE = 1000;
        await staking.setRewardPoolSize(NEW_STAKING_REWARD_POOL_SIZE);

        stakingPoolSize = await staking.getRewardPoolSize();
        expect(stakingPoolSize).to.be.eq(NEW_STAKING_REWARD_POOL_SIZE);
      });

      it('should not allow to set lower pool size than total rewards given', async function () {
        await staking.connect(staker1).stake(QUARTER_STAKING_AMOUNT, threeMonthsStakingPlanId);
        await staking.connect(staker1).stake(QUARTER_STAKING_AMOUNT, sixMonthsStakingPlanId);
        await staking.connect(staker1).stake(QUARTER_STAKING_AMOUNT, twelveMonthsStakingPlanId);
        await staking.connect(staker1).stake(QUARTER_STAKING_AMOUNT, twentyFourMonthsStakingPlanId);

        const rewardPoolSize = await staking.getRewardPoolSize();
        const rewardPoolLeft = await staking.getRewardPoolLeft();
        const totalRewardsGiven = rewardPoolSize - rewardPoolLeft;

        await expect(staking.setRewardPoolSize(totalRewardsGiven - BigInt(1))).to.be.revertedWithCustomError(
          staking,
          'NewRewardPoolSizeIsLessThanGiven',
        );
      });
    });

    describe('getRewardPoolLeft', function () {
      it('should return the correct pool left amount when no stakes', async function () {
        const rewardPoolLeft = await staking.getRewardPoolLeft();
        const rewardPoolSize = await staking.getRewardPoolSize();
        expect(rewardPoolLeft).to.be.eq(STAKING_REWARD_POOL_SIZE);
        expect(rewardPoolLeft).to.be.eq(rewardPoolSize);
      });

      it('should return the correct pool pool left after a couple of stakes', async function () {
        const stake1EsimatedEarnings = await staking.estimateStakeEarnings(
          QUARTER_STAKING_AMOUNT,
          threeMonthsStakingPlanId,
        );
        const stake2EsimatedEarnings = await staking.estimateStakeEarnings(
          QUARTER_STAKING_AMOUNT,
          sixMonthsStakingPlanId,
        );
        const stake3EsimatedEarnings = await staking.estimateStakeEarnings(
          QUARTER_STAKING_AMOUNT,
          twelveMonthsStakingPlanId,
        );
        const stake4EsimatedEarnings = await staking.estimateStakeEarnings(
          QUARTER_STAKING_AMOUNT,
          twentyFourMonthsStakingPlanId,
        );

        await staking.connect(staker1).stake(QUARTER_STAKING_AMOUNT, threeMonthsStakingPlanId);
        await staking.connect(staker1).stake(QUARTER_STAKING_AMOUNT, sixMonthsStakingPlanId);
        await staking.connect(staker1).stake(QUARTER_STAKING_AMOUNT, twelveMonthsStakingPlanId);
        await staking.connect(staker1).stake(QUARTER_STAKING_AMOUNT, twentyFourMonthsStakingPlanId);

        const allEarnings =
          stake1EsimatedEarnings.predictedEarningsInTokens +
          stake2EsimatedEarnings.predictedEarningsInTokens +
          stake3EsimatedEarnings.predictedEarningsInTokens +
          stake4EsimatedEarnings.predictedEarningsInTokens;

        const rewardPoolLeft = await staking.getRewardPoolLeft();
        const stakingPoolSize = await staking.getRewardPoolSize();

        expect(rewardPoolLeft).to.be.eq(stakingPoolSize - allEarnings);
      });

      it('should increase reward pool left if early withdrawn', async function () {
        const staker1Address = await staker1.getAddress();
        const stakeId = await staking.connect(staker1).stake.staticCall(QUARTER_STAKING_AMOUNT, threeMonthsStakingPlanId);
        const estimatedEarnings = await staking.estimateStakeEarnings(QUARTER_STAKING_AMOUNT, threeMonthsStakingPlanId);
        await staking.connect(staker1).stake(QUARTER_STAKING_AMOUNT, threeMonthsStakingPlanId);
        await stakingManagement.connect(deployer).enableWithdraw();
        const rewardPoolLeftBefore = await staking.getRewardPoolLeft();
        await staking.connect(staker1).withdraw(stakeId);
        const rewardPoolLeftAfter = await staking.getRewardPoolLeft();
        const stakeData = await staking.getStake(stakeId);

        expect(rewardPoolLeftAfter).to.be.gt(rewardPoolLeftBefore);
        expect(rewardPoolLeftAfter).to.be.eq(rewardPoolLeftBefore + estimatedEarnings.predictedEarningsInTokens);
      });
    });
  });
});

export type ExpectedEarningsResult = {
  expectedEarningsInTokens: bigint;
  expectedEarningsPercentage: bigint;
  expectedBalance: bigint;
};

export type StakeData = {
  stakingAmount: bigint;
  stakingPeriod: bigint;
  apy: bigint;
};

export function calculateExpectedEarnings(stake: StakeData): ExpectedEarningsResult {
  const SECONDS_IN_YEAR = BigInt(365 * 24 * 60 * 60);
  const SECONDS_IN_MONTH = BigInt(30 * 24 * 60 * 60);
  const HUNDRED_PERCENT = 10000n; // Basis points for APY
  const PRECISION = 1_000000000000000000n; // 1e18 for higher precision

  const stakingDuration = stake.stakingPeriod;
  const apyPercentage = BigInt(stake.apy);

  let compoundingPeriods: bigint;
  let periodRate: bigint;

  if (stakingDuration >= SECONDS_IN_YEAR) {
    // Annual compounding
    compoundingPeriods = stakingDuration / SECONDS_IN_YEAR;
    periodRate = (apyPercentage * PRECISION) / HUNDRED_PERCENT;
  } else {
    // Monthly compounding
    compoundingPeriods = stakingDuration / SECONDS_IN_MONTH;
    periodRate = (apyPercentage * PRECISION) / (HUNDRED_PERCENT * 12n);
  }

  let compoundedBalance = stake.stakingAmount * PRECISION;

  for (let i = 0n; i < compoundingPeriods; i++) {
    compoundedBalance = (compoundedBalance * (PRECISION + periodRate)) / PRECISION;
  }

  const earningsInTokens = (compoundedBalance / PRECISION) - stake.stakingAmount;
  const earningsPercentage = (earningsInTokens * HUNDRED_PERCENT) / stake.stakingAmount;

  return {
    expectedEarningsInTokens: earningsInTokens,
    expectedEarningsPercentage: earningsPercentage, // Already in basis points
    expectedBalance: earningsInTokens + stake.stakingAmount,
  };
}

export function calculateTotalExpectedEarnings(stakes: StakeData[]): ExpectedEarningsResult {
  let totalEarningsInTokens = 0n;
  let totalStaked = 0n;
  let totalWeightedPercentage = 0n;

  stakes.forEach(stake => {
    const earningsResult = calculateExpectedEarnings(stake);
    totalEarningsInTokens += earningsResult.expectedEarningsInTokens;
    totalWeightedPercentage += earningsResult.expectedEarningsPercentage * stake.stakingAmount;
    totalStaked += stake.stakingAmount;
  });

  let totalEarningsPercentage = 0n;
  if (totalStaked > 0n) {
    totalEarningsPercentage = totalWeightedPercentage / totalStaked; // Adjust for basis points
  }

  let expectedBalance = totalStaked + totalEarningsInTokens;

  return {
    expectedEarningsInTokens: totalEarningsInTokens,
    expectedEarningsPercentage: totalEarningsPercentage,
    expectedBalance: expectedBalance,
  };
}