import { expect } from "chai";
import { ethers, run } from "hardhat";
import { BigNumberish, Signer, formatUnits, id } from "ethers";
import { StakingManagement, Staking, IQTMock } from "../typechain";

export const solidityIdBytes32 = (string: string): string => {
  return id(string);
};

describe("Staking Contract", function () {
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

  const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
  const STAKING_MANAGER_ROLE = solidityIdBytes32("STAKING_MANAGER");
  const STAKER_BALANCE = 10000;
  const ZERO_AMOUNT = 0;

  beforeEach(async function () {
    const accounts = await ethers.getSigners();

    deployer = accounts[0];
    stakingManager = accounts[1]
    stranger = accounts[2];
    staker1 = accounts[3];
    staker2 = accounts[4];
    staker3 = accounts[5];
    staker4 = accounts[6];
    stakingPool = accounts[7];

    const deployerAddress = await deployer.getAddress();
    const stakingManagerAddress = await stakingManager.getAddress();
    const stakingPoolAddress = await stakingPool.getAddress();

    stakingToken = (await run("deploy:iqt-mock", { mintTo: deployerAddress })) as IQTMock;
    await stakingToken.connect(deployer).transfer(stakingPoolAddress, ethers.parseEther('1000000'));
    stakingManagement = (await run("deploy:staking-management", {
      stakingToken: stakingToken.target
    })) as StakingManagement;
    staking = (await run("deploy:staking", {
      stakingManagement: stakingManagement.target,
      stakingPool: stakingPoolAddress
    })) as Staking;

    await stakingManagement.connect(deployer).setStaking(staking.target);
    await stakingManagement.connect(deployer).grantRole(STAKING_MANAGER_ROLE, stakingManagerAddress);
    await stakingToken.connect(stakingPool).approve(staking.target, ethers.parseEther('1000000'));
  });

  describe("Deployment", function () {
    it("Should set the correct StakingManagement address", async function () {
      expect(await staking.getStakingManagement()).to.equal(stakingManagement.target);
    });

    it("Should set the correct StakingToken address", async function () {
      expect(await staking.getStakingToken()).to.equal(stakingToken.target);
    });

    it("Should set the correct StakingPool address", async function () {
      const stakingPoolAddress = await stakingPool.getAddress();
      expect(await staking.getStakingPool()).to.equal(stakingPoolAddress);
    });
  });

  describe("Functionality", function () {
    describe("stake", function () {
      /** APYs */
      const ZERO_PERCENT = 0;
      const HUNDRED_PERCENT = 100_00;
      const HUNDED_ONE_PERCENT = 100_01;
      const ONE_MONTH_APY = 10_50;
      const THREE_MONTHS_APY = 12_50;
      const SIX_MONTHS_APY = 14_50;
      const TWELVE_MONTHS_APY = 18_00;
      /** Time Frames */
      const ZERO_SECONDS = 0;
      const ONE_MONTH_IN_SECONDS = 2629746;
      const THREE_MONTHS_IN_SECONDS = 7889238;
      const SIX_MONTHS_IN_SECONDS = 15778476;
      const TWELVE_MONTHS_IN_SECONDS = 31556952;
      /** Staking amounts */
      const STAKING_AMOUNT = ethers.parseEther('100');
      const MORE_THAN_STAKING_AMOUNT = ethers.parseEther('101');
      const QUARTER_STAKING_AMOUNT = ethers.parseEther('25');
      const LESS_THAN_QUARTER_STAKING_AMOUNT = ethers.parseEther('24');
      const MORE_THAN_QUARTER_STAKING_AMOUNT = ethers.parseEther('26');
      const NON_EXISTING_PLAN_ID = 999;

      let oneMonthStakingPlanId: BigNumberish;
      let threeMonthsStakingPlanId: BigNumberish;
      let sixMonthsStakingPlanId: BigNumberish;
      let twelveMonthsStakingPlanId: BigNumberish;

      beforeEach(async function () {
        const staker1Address = await staker1.getAddress();
        const stakingPoolAddress = await stakingPool.getAddress();
        await stakingToken.connect(deployer).transfer(staker1Address, STAKING_AMOUNT);
        await stakingToken.connect(staker1).approve(staking.target, STAKING_AMOUNT);
        oneMonthStakingPlanId = await stakingManagement.connect(stakingManager).addStakingPlan.staticCall(ONE_MONTH_IN_SECONDS, ONE_MONTH_APY);
        await stakingManagement.connect(stakingManager).addStakingPlan(ONE_MONTH_IN_SECONDS, ONE_MONTH_APY);
        threeMonthsStakingPlanId = await stakingManagement.connect(stakingManager).addStakingPlan.staticCall(THREE_MONTHS_IN_SECONDS, THREE_MONTHS_APY);
        await stakingManagement.connect(stakingManager).addStakingPlan(THREE_MONTHS_IN_SECONDS, THREE_MONTHS_APY);
        sixMonthsStakingPlanId = await stakingManagement.connect(stakingManager).addStakingPlan.staticCall(SIX_MONTHS_IN_SECONDS, SIX_MONTHS_APY);
        await stakingManagement.connect(stakingManager).addStakingPlan(SIX_MONTHS_IN_SECONDS, SIX_MONTHS_APY);
        twelveMonthsStakingPlanId = await stakingManagement.addStakingPlan.staticCall(TWELVE_MONTHS_IN_SECONDS, TWELVE_MONTHS_APY);
        await stakingManagement.connect(stakingManager).addStakingPlan(TWELVE_MONTHS_IN_SECONDS, TWELVE_MONTHS_APY);

        await stakingManagement.connect(stakingManager).setStakingLimits(QUARTER_STAKING_AMOUNT, QUARTER_STAKING_AMOUNT);
      });

      it("should stake", async function () {
        const firstPlan = await stakingManagement.getStakingPlan(oneMonthStakingPlanId);
        console.log('FIRST PLAN: ', firstPlan);
        console.log('FIRST PLAN ID: ', oneMonthStakingPlanId);
        await expect(staking.connect(staker1).stake(QUARTER_STAKING_AMOUNT, oneMonthStakingPlanId)).to.not.be.reverted;
      });

      it("should emit an event when staking", async function () {
        const staker1Address = await staker1.getAddress();
        const expectedStakeId = await staking.connect(staker1).stake.staticCall(QUARTER_STAKING_AMOUNT, oneMonthStakingPlanId)
        await expect(staking.connect(staker1).stake(QUARTER_STAKING_AMOUNT, oneMonthStakingPlanId))
          .to.emit(staking, "StakeAdded")
          .withArgs(staker1Address, expectedStakeId);
      });

      it("should increase amount of stakes per plan", async function () {
        let stakesPerPlan;
        const staker1Address = await staker1.getAddress();
        stakesPerPlan = await staking.getStakesAmountPerPlan(oneMonthStakingPlanId);
        expect(stakesPerPlan).to.equal(0);
        await expect(staking.connect(staker1).stake(QUARTER_STAKING_AMOUNT, oneMonthStakingPlanId)).to.not.be.reverted;
        stakesPerPlan = await staking.getStakesAmountPerPlan(oneMonthStakingPlanId);
        expect(stakesPerPlan).to.equal(1);
      });

      it("should allow me to stake and withdraw with all different staking plans", async function () {
        const staker1Address = await staker1.getAddress();
        await stakingManagement.connect(deployer).setStakingLimits(QUARTER_STAKING_AMOUNT, QUARTER_STAKING_AMOUNT);
        const firstStakeId = await staking.connect(staker1).stake.staticCall(QUARTER_STAKING_AMOUNT, oneMonthStakingPlanId);
        await staking.connect(staker1).stake(QUARTER_STAKING_AMOUNT, oneMonthStakingPlanId);
        const secondStakeId = await staking.connect(staker1).stake.staticCall(QUARTER_STAKING_AMOUNT, threeMonthsStakingPlanId);
        await staking.connect(staker1).stake(QUARTER_STAKING_AMOUNT, threeMonthsStakingPlanId);
        const thirdStakeId = await staking.connect(staker1).stake.staticCall(QUARTER_STAKING_AMOUNT, sixMonthsStakingPlanId);
        await staking.connect(staker1).stake(QUARTER_STAKING_AMOUNT, sixMonthsStakingPlanId);
        const fourthStakeId = await staking.connect(staker1).stake.staticCall(QUARTER_STAKING_AMOUNT, twelveMonthsStakingPlanId);
        await staking.connect(staker1).stake(QUARTER_STAKING_AMOUNT, twelveMonthsStakingPlanId);

        const firstStakeEstimatedEarnings = await staking.estimateStakeEarnings(QUARTER_STAKING_AMOUNT, oneMonthStakingPlanId);

        await ethers.provider.send("evm_increaseTime", [TWELVE_MONTHS_IN_SECONDS]);
        await ethers.provider.send("evm_mine");

        await staking.connect(staker1).withdraw(firstStakeId);

        const balanceAfterFirstWithdrawal = await stakingToken.balanceOf(staker1Address);
        const firstStakeEarnings = await staking.calculateStakeEarnings(firstStakeId);
        const expectedFirstStakeEarnings = calculateExpectedEarnings({
          stakingAmount: QUARTER_STAKING_AMOUNT,
          stakingPeriod: BigInt(ONE_MONTH_IN_SECONDS),
          apy: BigInt(ONE_MONTH_APY),
        });

        expect(firstStakeEstimatedEarnings.predictedEarningsInTokens).to.be.eq(firstStakeEarnings.earningsInTokens);
        expect(firstStakeEstimatedEarnings.predictedEarningsPercentage).to.be.eq(firstStakeEarnings.earningsPercentage);
        expect(firstStakeEarnings.earningsInTokens).to.equal(expectedFirstStakeEarnings.expectedEarningsInTokens);
        expect(firstStakeEarnings.earningsPercentage).to.equal(expectedFirstStakeEarnings.expectedEarningsPercentage);
        expect(balanceAfterFirstWithdrawal).to.equal(expectedFirstStakeEarnings.expectedBalance);

        const firstStake = await staking.getStake(firstStakeId);
        expect(firstStake.staker).to.equal(staker1Address);
        expect(firstStake.amount).to.equal(QUARTER_STAKING_AMOUNT);
        expect(firstStake.stakingPlanId).to.equal(oneMonthStakingPlanId);
        expect(firstStake.earningsInTokens).to.equal(expectedFirstStakeEarnings.expectedEarningsInTokens);
        expect(firstStake.earningsPercentage).to.equal(expectedFirstStakeEarnings.expectedEarningsPercentage);
        expect(firstStake.earlyWithdrawal).to.equal(false);
        expect(firstStake.withdrawn).to.equal(true);

        const secondStakeEstimatedEarnings = await staking.estimateStakeEarnings(QUARTER_STAKING_AMOUNT, threeMonthsStakingPlanId);

        await ethers.provider.send("evm_increaseTime", [THREE_MONTHS_IN_SECONDS - ONE_MONTH_IN_SECONDS]);
        await ethers.provider.send("evm_mine");

        await staking.connect(staker1).withdraw(secondStakeId);

        const secondStakeEarnings = await staking.calculateStakeEarnings(secondStakeId);
        const balanceAfterSecondWithdrawal = await stakingToken.balanceOf(staker1Address);
        const expectedSecondStakeEarnings = calculateExpectedEarnings({
          stakingAmount: QUARTER_STAKING_AMOUNT,
          stakingPeriod: BigInt(THREE_MONTHS_IN_SECONDS),
          apy: BigInt(THREE_MONTHS_APY),
        });

        expect(secondStakeEstimatedEarnings.predictedEarningsInTokens).to.be.eq(secondStakeEarnings.earningsInTokens);
        expect(secondStakeEstimatedEarnings.predictedEarningsPercentage).to.be.eq(secondStakeEarnings.earningsPercentage);
        expect(secondStakeEarnings.earningsInTokens).to.equal(expectedSecondStakeEarnings.expectedEarningsInTokens);
        expect(secondStakeEarnings.earningsPercentage).to.equal(expectedSecondStakeEarnings.expectedEarningsPercentage);
        expect(balanceAfterSecondWithdrawal).to.equal(
          expectedFirstStakeEarnings.expectedBalance +
          expectedSecondStakeEarnings.expectedBalance
        );

        const secondStake = await staking.getStake(secondStakeId);
        expect(secondStake.staker).to.equal(staker1Address);
        expect(secondStake.amount).to.equal(QUARTER_STAKING_AMOUNT);
        expect(secondStake.stakingPlanId).to.equal(threeMonthsStakingPlanId);
        expect(secondStake.earningsInTokens).to.equal(expectedSecondStakeEarnings.expectedEarningsInTokens);
        expect(secondStake.earningsPercentage).to.equal(expectedSecondStakeEarnings.expectedEarningsPercentage);
        expect(secondStake.earlyWithdrawal).to.equal(false);
        expect(secondStake.withdrawn).to.equal(true);

        const thirdStakeEstimatedEarnings = await staking.estimateStakeEarnings(QUARTER_STAKING_AMOUNT, sixMonthsStakingPlanId);

        await ethers.provider.send("evm_increaseTime", [SIX_MONTHS_IN_SECONDS - THREE_MONTHS_IN_SECONDS]);
        await ethers.provider.send("evm_mine");

        await staking.connect(staker1).withdraw(thirdStakeId);

        const thirdStakeEarnings = await staking.calculateStakeEarnings(thirdStakeId);
        const balanceAfterThirdWithdrawal = await stakingToken.balanceOf(staker1Address);
        const expectedThirdStakeEarnings = calculateExpectedEarnings({
          stakingAmount: QUARTER_STAKING_AMOUNT,
          stakingPeriod: BigInt(SIX_MONTHS_IN_SECONDS),
          apy: BigInt(SIX_MONTHS_APY),
        });

        expect(thirdStakeEstimatedEarnings.predictedEarningsInTokens).to.be.eq(thirdStakeEarnings.earningsInTokens);
        expect(thirdStakeEstimatedEarnings.predictedEarningsPercentage).to.be.eq(thirdStakeEarnings.earningsPercentage);
        expect(thirdStakeEarnings.earningsInTokens).to.equal(expectedThirdStakeEarnings.expectedEarningsInTokens);
        expect(thirdStakeEarnings.earningsPercentage).to.equal(expectedThirdStakeEarnings.expectedEarningsPercentage);
        expect(balanceAfterThirdWithdrawal).to.equal(
          expectedFirstStakeEarnings.expectedBalance +
          expectedSecondStakeEarnings.expectedBalance +
          expectedThirdStakeEarnings.expectedBalance
        );

        const thirdStake = await staking.getStake(thirdStakeId);
        expect(thirdStake.staker).to.equal(staker1Address);
        expect(thirdStake.amount).to.equal(QUARTER_STAKING_AMOUNT);
        expect(thirdStake.stakingPlanId).to.equal(sixMonthsStakingPlanId);
        expect(thirdStake.earningsInTokens).to.equal(expectedThirdStakeEarnings.expectedEarningsInTokens);
        expect(thirdStake.earningsPercentage).to.equal(expectedThirdStakeEarnings.expectedEarningsPercentage);
        expect(thirdStake.earlyWithdrawal).to.equal(false);
        expect(thirdStake.withdrawn).to.equal(true);

        const fourthStakeEstimatedEarnings = await staking.estimateStakeEarnings(QUARTER_STAKING_AMOUNT, twelveMonthsStakingPlanId);

        await ethers.provider.send("evm_increaseTime", [TWELVE_MONTHS_IN_SECONDS - SIX_MONTHS_IN_SECONDS]);
        await ethers.provider.send("evm_mine");

        await staking.connect(staker1).withdraw(fourthStakeId);
        const fourthStakeEarnings = await staking.calculateStakeEarnings(fourthStakeId);
        const blaanceAfterFourthWithdrawal = await stakingToken.balanceOf(staker1Address);
        const expectedFourthStakeEarnings = calculateExpectedEarnings({
          stakingAmount: QUARTER_STAKING_AMOUNT,
          stakingPeriod: BigInt(TWELVE_MONTHS_IN_SECONDS),
          apy: BigInt(TWELVE_MONTHS_APY),
        });

        expect(fourthStakeEstimatedEarnings.predictedEarningsInTokens).to.be.eq(fourthStakeEarnings.earningsInTokens);
        expect(fourthStakeEstimatedEarnings.predictedEarningsPercentage).to.be.eq(fourthStakeEarnings.earningsPercentage);
        expect(fourthStakeEarnings.earningsInTokens).to.equal(expectedFourthStakeEarnings.expectedEarningsInTokens);
        expect(fourthStakeEarnings.earningsPercentage).to.equal(expectedFourthStakeEarnings.expectedEarningsPercentage);
        expect(blaanceAfterFourthWithdrawal).to.equal(
          expectedFirstStakeEarnings.expectedBalance +
          expectedSecondStakeEarnings.expectedBalance +
          expectedThirdStakeEarnings.expectedBalance +
          expectedFourthStakeEarnings.expectedBalance
        );

        const fourthStake = await staking.getStake(fourthStakeId);
        expect(fourthStake.staker).to.equal(staker1Address);
        expect(fourthStake.amount).to.equal(QUARTER_STAKING_AMOUNT);
        expect(fourthStake.stakingPlanId).to.equal(twelveMonthsStakingPlanId);
        expect(fourthStake.earningsInTokens).to.equal(expectedFourthStakeEarnings.expectedEarningsInTokens);
        expect(fourthStake.earningsPercentage).to.equal(expectedFourthStakeEarnings.expectedEarningsPercentage);
        expect(fourthStake.earlyWithdrawal).to.equal(false);
        expect(fourthStake.withdrawn).to.equal(true);

        const totalExpectedEarnings = calculateTotalExpectedEarnings([
          { stakingAmount: QUARTER_STAKING_AMOUNT, stakingPeriod: BigInt(ONE_MONTH_IN_SECONDS), apy: BigInt(ONE_MONTH_APY) },
          { stakingAmount: QUARTER_STAKING_AMOUNT, stakingPeriod: BigInt(THREE_MONTHS_IN_SECONDS), apy: BigInt(THREE_MONTHS_APY) },
          { stakingAmount: QUARTER_STAKING_AMOUNT, stakingPeriod: BigInt(SIX_MONTHS_IN_SECONDS), apy: BigInt(SIX_MONTHS_APY) },
          { stakingAmount: QUARTER_STAKING_AMOUNT, stakingPeriod: BigInt(TWELVE_MONTHS_IN_SECONDS), apy: BigInt(TWELVE_MONTHS_APY) },
        ]);

        expect(blaanceAfterFourthWithdrawal).to.equal(totalExpectedEarnings.expectedBalance);
      });

      it("Should not assume any earnings if staking period is zero", async function () {
        const staker1Address = await staker1.getAddress();
        const stakeId = await staking.connect(staker1).stake.staticCall(QUARTER_STAKING_AMOUNT, oneMonthStakingPlanId);
        await staking.connect(staker1).stake(QUARTER_STAKING_AMOUNT, oneMonthStakingPlanId);
        const staker1BalanceAfterStaking = await stakingToken.balanceOf(staker1Address);
        const stakeEarnings = await staking.calculateStakeEarnings(stakeId);
        expect(stakeEarnings.earningsInTokens).to.equal(0n);
        expect(stakeEarnings.earningsPercentage).to.equal(0n);
        expect(staker1BalanceAfterStaking).to.equal(STAKING_AMOUNT - QUARTER_STAKING_AMOUNT);
      });

      it("Should not count any earnings if doing early withdrawal", async function () {
        const staker1Address = await staker1.getAddress();
        const stakeId = await staking.connect(staker1).stake.staticCall(QUARTER_STAKING_AMOUNT, oneMonthStakingPlanId);
        await staking.connect(staker1).stake(QUARTER_STAKING_AMOUNT, oneMonthStakingPlanId);
        await stakingManagement.connect(deployer).enableWithdraw();
        await ethers.provider.send("evm_increaseTime", [ONE_MONTH_IN_SECONDS / 2]);
        await ethers.provider.send("evm_mine");
        await staking.connect(staker1).withdraw(stakeId);
        const staker1BalanceAfterWithdraw = await stakingToken.balanceOf(staker1Address);
        expect(staker1BalanceAfterWithdraw).to.equal(STAKING_AMOUNT);
      });

      it("Should revert when staking amount is less than minimum staking amount", async function () {
        await expect(staking.connect(staker1).stake(LESS_THAN_QUARTER_STAKING_AMOUNT, oneMonthStakingPlanId)).to.be.revertedWithCustomError(
          staking,
          "AmountIsLessThanMinimumStake"
        );
      });

      it("Should revert when staking amount is more than maximum staking amount", async function () {
        await expect(staking.connect(staker1).stake(MORE_THAN_QUARTER_STAKING_AMOUNT, oneMonthStakingPlanId)).to.be.revertedWithCustomError(
          staking, "AmountIsGreaterThanMaximumStake"
        );
      });

      it("Should revert when staking pool balance is not enough to cover withdraw + estimated earnings", async function () {
        const stakingPoolBalance = await stakingToken.balanceOf(await stakingPool.getAddress());
        const strangerAddress = await stranger.getAddress();
        await stakingToken.connect(stakingPool).transfer(strangerAddress, stakingPoolBalance);

        await expect(staking.connect(staker1).stake(QUARTER_STAKING_AMOUNT, oneMonthStakingPlanId)).to.be.revertedWithCustomError(
          staking, "InsufficientStakingPoolBalance"
        );
      })

      it("should revert when allowance is not given to staking contract", async function () {
        await stakingToken.connect(staker1).approve(staking.target, 0);
        await expect(staking.connect(staker1).stake(QUARTER_STAKING_AMOUNT, oneMonthStakingPlanId)).to.be.revertedWith(
          "ERC20: insufficient allowance"
        );
      });

      it("Should revert when staking plan does not exist", async function () {
        await expect(staking.connect(staker1).stake(QUARTER_STAKING_AMOUNT, NON_EXISTING_PLAN_ID)).to.be.revertedWithCustomError(
          stakingManagement,
          "StakingPlanDoesNotExist"
        );
      });
    });

    describe("withdraw", function () {
      /** APYs */
      const ONE_MONTH_APY = 10_50;
      /** Time Frames */
      const ONE_MONTH_IN_SECONDS = 2629746;
      /** Staking amounts */
      const STAKING_AMOUNT = ethers.parseEther('100');
      const QUARTER_STAKING_AMOUNT = ethers.parseEther('25');
      const NON_EXISTING_PLAN_ID = 999;
      const NON_EXISTING_STAKE_ID = 999;

      let oneMonthStakingPlanId: BigNumberish;

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
        oneMonthStakingPlanId = await stakingManagement.addStakingPlan.staticCall(ONE_MONTH_IN_SECONDS, ONE_MONTH_APY);
        await stakingManagement.connect(stakingManager).addStakingPlan(ONE_MONTH_IN_SECONDS, ONE_MONTH_APY);
        await stakingManagement.connect(stakingManager).setStakingLimits(QUARTER_STAKING_AMOUNT, QUARTER_STAKING_AMOUNT);
      });

      it("should withdraw", async function () {
        const stakeId = await staking.connect(staker1).stake.staticCall(QUARTER_STAKING_AMOUNT, oneMonthStakingPlanId);
        const estimatedStakeEarnings = await staking.estimateStakeEarnings(QUARTER_STAKING_AMOUNT, oneMonthStakingPlanId);
        await staking.connect(staker1).stake(QUARTER_STAKING_AMOUNT, oneMonthStakingPlanId);
        await ethers.provider.send("evm_increaseTime", [ONE_MONTH_IN_SECONDS]);
        await ethers.provider.send("evm_mine");
        await expect(staking.connect(staker1).withdraw(stakeId)).to.not.be.reverted;
        const expectedStakeEarnings = calculateExpectedEarnings({
          stakingAmount: QUARTER_STAKING_AMOUNT,
          stakingPeriod: BigInt(ONE_MONTH_IN_SECONDS),
          apy: BigInt(ONE_MONTH_APY),
        });
        const stakeRecord = await staking.getStake(stakeId);
        expect(stakeRecord.earlyWithdrawal).to.equal(false);
        expect(stakeRecord.withdrawn).to.equal(true);
        expect(expectedStakeEarnings.expectedEarningsInTokens).to.eq(estimatedStakeEarnings.predictedEarningsInTokens);
        expect(expectedStakeEarnings.expectedEarningsPercentage).to.eq(estimatedStakeEarnings.predictedEarningsPercentage);
        expect(stakeRecord.earningsInTokens).to.equal(expectedStakeEarnings.expectedEarningsInTokens);
        expect(stakeRecord.earningsPercentage).to.equal(expectedStakeEarnings.expectedEarningsPercentage);
        expect(stakeRecord.startTimestamp).to.equal(stakeRecord.endTimestamp - BigInt(ONE_MONTH_IN_SECONDS));

      });

      it("should emit an event when withdrawing", async function () {
        const staker1Address = await staker1.getAddress();
        const stakeId = await staking.connect(staker1).stake.staticCall(QUARTER_STAKING_AMOUNT, oneMonthStakingPlanId);
        await staking.connect(staker1).stake(QUARTER_STAKING_AMOUNT, oneMonthStakingPlanId);
        await ethers.provider.send("evm_increaseTime", [ONE_MONTH_IN_SECONDS]);
        await ethers.provider.send("evm_mine");
        await expect(staking.connect(staker1).withdraw(stakeId))
          .to.emit(staking, "StakeWithdrawn")
          .withArgs(staker1Address, stakeId);
      });

      it("should allow to withdraw only initial stake if early withdrawal", async function () {
        let stakeRecord;

        const stakeId = await staking.connect(staker1).stake.staticCall(QUARTER_STAKING_AMOUNT, oneMonthStakingPlanId);
        const currentBlock = await ethers.provider.getBlock('latest');
        const stakeTimestamp = currentBlock!.timestamp;
        await staking.connect(staker1).stake(QUARTER_STAKING_AMOUNT, oneMonthStakingPlanId);
        stakeRecord = await staking.getStake(stakeId);
        const initialStakeEndTimestamp = stakeRecord.endTimestamp;
        await stakingManagement.connect(deployer).enableWithdraw();
        await ethers.provider.send("evm_increaseTime", [ONE_MONTH_IN_SECONDS / 2]);
        await ethers.provider.send("evm_mine");
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

      it("should decrease the amount of stakes per plan once withdrawn", async function () {
        let stakesPerPlan;
        stakesPerPlan = await staking.getStakesAmountPerPlan(oneMonthStakingPlanId);
        expect(stakesPerPlan).to.equal(0);
        const stakeId = await staking.connect(staker1).stake.staticCall(QUARTER_STAKING_AMOUNT, oneMonthStakingPlanId);
        await staking.connect(staker1).stake(QUARTER_STAKING_AMOUNT, oneMonthStakingPlanId);
        stakesPerPlan = await staking.getStakesAmountPerPlan(oneMonthStakingPlanId);
        expect(stakesPerPlan).to.equal(1);
        await ethers.provider.send("evm_increaseTime", [ONE_MONTH_IN_SECONDS]);
        await ethers.provider.send("evm_mine");
        await expect(staking.connect(staker1).withdraw(stakeId)).to.not.be.reverted;
        stakesPerPlan = await staking.getStakesAmountPerPlan(oneMonthStakingPlanId);
        expect(stakesPerPlan).to.equal(0);
      });

      it("should revert when stake does not exist", async function () {
        await expect(staking.connect(staker1).withdraw(NON_EXISTING_STAKE_ID)).to.be.revertedWithCustomError(
          staking,
          "StakeDoesNotExist"
        );
      });

      it("should revert when stake is attempted to be withdrawn by stranger", async function () {
        const staker1Address = await staker1.getAddress();
        const stakeId = await staking.connect(staker1).stake.staticCall(QUARTER_STAKING_AMOUNT, oneMonthStakingPlanId);
        await staking.connect(staker1).stake(QUARTER_STAKING_AMOUNT, oneMonthStakingPlanId);
        await ethers.provider.send("evm_increaseTime", [ONE_MONTH_IN_SECONDS]);
        await ethers.provider.send("evm_mine");
        await expect(staking.connect(stranger).withdraw(stakeId)).to.be.revertedWithCustomError(
          staking,
          "CallerIsNotStakeOwner"
        );
      });

      it("should revert when stake is already withdrawn", async function () {
        const stakeId = await staking.connect(staker1).stake.staticCall(QUARTER_STAKING_AMOUNT, oneMonthStakingPlanId);
        await staking.connect(staker1).stake(QUARTER_STAKING_AMOUNT, oneMonthStakingPlanId);
        await ethers.provider.send("evm_increaseTime", [ONE_MONTH_IN_SECONDS]);
        await ethers.provider.send("evm_mine");
        await staking.connect(staker1).withdraw(stakeId);
        await expect(staking.connect(staker1).withdraw(stakeId)).to.be.revertedWithCustomError(
          staking,
          "StakeAlreadyWithdrawn"
        );
      });

      it("should revert when stake is not matured and early withdrawal disabled", async function () {
        const stakeId = await staking.connect(staker1).stake.staticCall(QUARTER_STAKING_AMOUNT, oneMonthStakingPlanId);
        await staking.connect(staker1).stake(QUARTER_STAKING_AMOUNT, oneMonthStakingPlanId);
        await expect(staking.connect(staker1).withdraw(stakeId)).to.be.revertedWithCustomError(
          staking,
          "EarlyWithdrawalNotAllowed"
        );
      });

      it("should revert when staking pool is empty", async function () {
        const stakingPoolAddress = await stakingPool.getAddress();
        const strangerAddress = await stranger.getAddress();
        const stakingPoolBalance = await stakingToken.balanceOf(stakingPoolAddress);
        const stakeId = await staking.connect(staker1).stake.staticCall(QUARTER_STAKING_AMOUNT, oneMonthStakingPlanId);
        await staking.connect(staker1).stake(QUARTER_STAKING_AMOUNT, oneMonthStakingPlanId);
        await ethers.provider.send("evm_increaseTime", [ONE_MONTH_IN_SECONDS]);
        await ethers.provider.send("evm_mine");
        await stakingToken.connect(stakingPool).transfer(strangerAddress, stakingPoolBalance);
        await expect(staking.connect(staker1).withdraw(stakeId)).to.be.revertedWith(
          "ERC20: transfer amount exceeds balance"
        );
      });
    });
  });

  describe("View Functions", function () {
    /** APYs */
    const ZERO_PERCENT = 0;
    const HUNDRED_PERCENT = 100_00;
    const HUNDED_ONE_PERCENT = 100_01;
    const ONE_MONTH_APY = 10_50;
    const THREE_MONTHS_APY = 12_50;
    const SIX_MONTHS_APY = 14_50;
    const TWELVE_MONTHS_APY = 18_00;
    /** Time Frames */
    const ZERO_SECONDS = 0;
    const ONE_MONTH_IN_SECONDS = 2629746;
    const THREE_MONTHS_IN_SECONDS = 7889238;
    const SIX_MONTHS_IN_SECONDS = 15778476;
    const TWELVE_MONTHS_IN_SECONDS = 31556952;
    /** Staking amounts */
    const STAKING_AMOUNT = ethers.parseEther('100');
    const QUARTER_STAKING_AMOUNT = ethers.parseEther('25');
    const NON_EXISTING_PLAN_ID = 999;
    const NON_EXISTING_STAKE_ID = 999;

    let oneMonthStakingPlanId: BigNumberish;
    let threeMonthsStakingPlanId: BigNumberish;
    let sixMonthsStakingPlanId: BigNumberish;
    let twelveMonthsStakingPlanId: BigNumberish;

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
      oneMonthStakingPlanId = await stakingManagement.connect(stakingManager).addStakingPlan.staticCall(ONE_MONTH_IN_SECONDS, ONE_MONTH_APY);
      await stakingManagement.connect(stakingManager).addStakingPlan(ONE_MONTH_IN_SECONDS, ONE_MONTH_APY);
      threeMonthsStakingPlanId = await stakingManagement.connect(stakingManager).addStakingPlan.staticCall(THREE_MONTHS_IN_SECONDS, THREE_MONTHS_APY);
      await stakingManagement.connect(stakingManager).addStakingPlan(THREE_MONTHS_IN_SECONDS, THREE_MONTHS_APY);
      sixMonthsStakingPlanId = await stakingManagement.connect(stakingManager).addStakingPlan.staticCall(SIX_MONTHS_IN_SECONDS, SIX_MONTHS_APY);
      await stakingManagement.connect(stakingManager).addStakingPlan(SIX_MONTHS_IN_SECONDS, SIX_MONTHS_APY);
      twelveMonthsStakingPlanId = await stakingManagement.connect(stakingManager).addStakingPlan.staticCall(TWELVE_MONTHS_IN_SECONDS, TWELVE_MONTHS_APY);
      await stakingManagement.connect(stakingManager).addStakingPlan(TWELVE_MONTHS_IN_SECONDS, TWELVE_MONTHS_APY);
      await stakingManagement.connect(stakingManager).setStakingLimits(QUARTER_STAKING_AMOUNT, QUARTER_STAKING_AMOUNT);
    });

    describe("getStakingPlan", function () {
      it("should return the correct staking plan", async function () {
        const oneMonthStakingPlan = await stakingManagement.getStakingPlan(oneMonthStakingPlanId);
        expect(oneMonthStakingPlan.duration).to.equal(ONE_MONTH_IN_SECONDS);
        expect(oneMonthStakingPlan.apy).to.equal(ONE_MONTH_APY);
      });

      it("should revert when staking plan does not exist", async function () {
        await expect(stakingManagement.getStakingPlan(NON_EXISTING_PLAN_ID)).to.be.revertedWithCustomError(
          stakingManagement,
          "StakingPlanDoesNotExist"
        );
      });
    });

    describe("getStake", function () {
      it("should return the correct stake", async function () {
        const staker1Address = await staker1.getAddress();
        const stakeId = await staking.connect(staker1).stake.staticCall(QUARTER_STAKING_AMOUNT, oneMonthStakingPlanId);
        await staking.connect(staker1).stake(QUARTER_STAKING_AMOUNT, oneMonthStakingPlanId);
        const stake = await staking.getStake(stakeId);
        expect(stake.staker).to.equal(staker1Address);
        expect(stake.amount).to.equal(QUARTER_STAKING_AMOUNT);
        expect(stake.stakingPlanId).to.equal(oneMonthStakingPlanId);
        expect(stake.earningsInTokens).to.equal(0n);
        expect(stake.earningsPercentage).to.equal(0n);
        expect(stake.earlyWithdrawal).to.equal(false);
        expect(stake.withdrawn).to.equal(false);
      });

      it("should revert when stake does not exist", async function () {
        await expect(staking.getStake(NON_EXISTING_STAKE_ID)).to.be.revertedWithCustomError(
          staking,
          "StakeDoesNotExist"
        );
      });
    });

    describe("calculateStakeEarnings", function () {
      it("should return the correct stake earnings after staking period is over", async function () {
        const stakeId = await staking.connect(staker1).stake.staticCall(QUARTER_STAKING_AMOUNT, oneMonthStakingPlanId);
        await staking.connect(staker1).stake(QUARTER_STAKING_AMOUNT, oneMonthStakingPlanId);
        await ethers.provider.send("evm_increaseTime", [ONE_MONTH_IN_SECONDS]);
        await ethers.provider.send("evm_mine");
        const stakeEarnings = await staking.calculateStakeEarnings(stakeId);
        const expectedStakeEarnings = calculateExpectedEarnings({
          stakingAmount: QUARTER_STAKING_AMOUNT,
          stakingPeriod: BigInt(ONE_MONTH_IN_SECONDS),
          apy: BigInt(ONE_MONTH_APY),
        });
        expect(stakeEarnings.earningsInTokens).to.equal(expectedStakeEarnings.expectedEarningsInTokens);
        expect(stakeEarnings.earningsPercentage).to.equal(expectedStakeEarnings.expectedEarningsPercentage);
      });

      it("should return the correct amount during staking period", async function () {
        const stakeId = await staking.connect(staker1).stake.staticCall(QUARTER_STAKING_AMOUNT, oneMonthStakingPlanId);
        await staking.connect(staker1).stake(QUARTER_STAKING_AMOUNT, oneMonthStakingPlanId);
        await ethers.provider.send("evm_increaseTime", [ONE_MONTH_IN_SECONDS / 2]);
        await ethers.provider.send("evm_mine");
        const stakeEarnings = await staking.calculateStakeEarnings(stakeId);
        const expectedStakeEarnings = calculateExpectedEarnings({
          stakingAmount: QUARTER_STAKING_AMOUNT,
          stakingPeriod: BigInt(ONE_MONTH_IN_SECONDS / 2),
          apy: BigInt(ONE_MONTH_APY),
        });
        expect(stakeEarnings.earningsInTokens).to.equal(expectedStakeEarnings.expectedEarningsInTokens);
        expect(stakeEarnings.earningsPercentage).to.equal(expectedStakeEarnings.expectedEarningsPercentage);
      });

      it("should revert when stake does not exist", async function () {
        await expect(staking.calculateStakeEarnings(NON_EXISTING_STAKE_ID)).to.be.revertedWithCustomError(
          staking,
          "StakeDoesNotExist"
        );
      });
    });

    describe("estimateStakeEarnings", function () {
      it("should estimate the correct amount for 1m and 10% APY", async function () {
        const estimatedEarnings = await staking.estimateStakeEarnings(QUARTER_STAKING_AMOUNT, oneMonthStakingPlanId);
        const stakeId = await staking.connect(staker1).stake.staticCall(QUARTER_STAKING_AMOUNT, oneMonthStakingPlanId);
        await staking.connect(staker1).stake(QUARTER_STAKING_AMOUNT, oneMonthStakingPlanId);
        await ethers.provider.send("evm_increaseTime", [ONE_MONTH_IN_SECONDS]);
        await ethers.provider.send("evm_mine");
        await expect(staking.connect(staker1).withdraw(stakeId)).to.not.be.reverted;
        const expectedStakeEarnings = calculateExpectedEarnings({
          stakingAmount: QUARTER_STAKING_AMOUNT,
          stakingPeriod: BigInt(ONE_MONTH_IN_SECONDS),
          apy: BigInt(ONE_MONTH_APY),
        });
        const stakeRecord = await staking.getStake(stakeId);
        expect(estimatedEarnings.predictedEarningsInTokens).to.equal(expectedStakeEarnings.expectedEarningsInTokens);
        expect(estimatedEarnings.predictedEarningsPercentage).to.equal(expectedStakeEarnings.expectedEarningsPercentage);
        expect(stakeRecord.earningsInTokens).to.equal(estimatedEarnings.predictedEarningsInTokens);
        expect(stakeRecord.earningsPercentage).to.equal(estimatedEarnings.predictedEarningsPercentage);
      });

      it("should estimate the correct amount for 3m and 12% APY", async function () {
        const estimatedEarnings = await staking.estimateStakeEarnings(QUARTER_STAKING_AMOUNT, threeMonthsStakingPlanId);
        const stakeId = await staking.connect(staker1).stake.staticCall(QUARTER_STAKING_AMOUNT, threeMonthsStakingPlanId);
        await staking.connect(staker1).stake(QUARTER_STAKING_AMOUNT, threeMonthsStakingPlanId);
        await ethers.provider.send("evm_increaseTime", [THREE_MONTHS_IN_SECONDS]);
        await ethers.provider.send("evm_mine");
        await expect(staking.connect(staker1).withdraw(stakeId)).to.not.be.reverted;
        const expectedStakeEarnings = calculateExpectedEarnings({
          stakingAmount: QUARTER_STAKING_AMOUNT,
          stakingPeriod: BigInt(THREE_MONTHS_IN_SECONDS),
          apy: BigInt(THREE_MONTHS_APY),
        });
        const stakeRecord = await staking.getStake(stakeId);
        expect(estimatedEarnings.predictedEarningsInTokens).to.equal(expectedStakeEarnings.expectedEarningsInTokens);
        expect(estimatedEarnings.predictedEarningsPercentage).to.equal(expectedStakeEarnings.expectedEarningsPercentage);
        expect(stakeRecord.earningsInTokens).to.equal(estimatedEarnings.predictedEarningsInTokens);
        expect(stakeRecord.earningsPercentage).to.equal(estimatedEarnings.predictedEarningsPercentage);
      });

      it("should estimate the correct amount for 6m and 14% APY", async function () {
        const estimatedEarnings = await staking.estimateStakeEarnings(QUARTER_STAKING_AMOUNT, sixMonthsStakingPlanId);
        const stakeId = await staking.connect(staker1).stake.staticCall(QUARTER_STAKING_AMOUNT, sixMonthsStakingPlanId);
        await staking.connect(staker1).stake(QUARTER_STAKING_AMOUNT, sixMonthsStakingPlanId);
        await ethers.provider.send("evm_increaseTime", [SIX_MONTHS_IN_SECONDS]);
        await ethers.provider.send("evm_mine");
        await expect(staking.connect(staker1).withdraw(stakeId)).to.not.be.reverted;
        const expectedStakeEarnings = calculateExpectedEarnings({
          stakingAmount: QUARTER_STAKING_AMOUNT,
          stakingPeriod: BigInt(SIX_MONTHS_IN_SECONDS),
          apy: BigInt(SIX_MONTHS_APY),
        });
        const stakeRecord = await staking.getStake(stakeId);
        expect(estimatedEarnings.predictedEarningsInTokens).to.equal(expectedStakeEarnings.expectedEarningsInTokens);
        expect(estimatedEarnings.predictedEarningsPercentage).to.equal(expectedStakeEarnings.expectedEarningsPercentage);
        expect(stakeRecord.earningsInTokens).to.equal(estimatedEarnings.predictedEarningsInTokens);
        expect(stakeRecord.earningsPercentage).to.equal(estimatedEarnings.predictedEarningsPercentage);
      });

      it("should estimate the correct amount for 12m and 18% APY", async function () {
        const estimatedEarnings = await staking.estimateStakeEarnings(QUARTER_STAKING_AMOUNT, twelveMonthsStakingPlanId);
        const stakeId = await staking.connect(staker1).stake.staticCall(QUARTER_STAKING_AMOUNT, twelveMonthsStakingPlanId);
        await staking.connect(staker1).stake(QUARTER_STAKING_AMOUNT, twelveMonthsStakingPlanId);
        await ethers.provider.send("evm_increaseTime", [TWELVE_MONTHS_IN_SECONDS]);
        await ethers.provider.send("evm_mine");
        await expect(staking.connect(staker1).withdraw(stakeId)).to.not.be.reverted;
        const expectedStakeEarnings = calculateExpectedEarnings({
          stakingAmount: QUARTER_STAKING_AMOUNT,
          stakingPeriod: BigInt(TWELVE_MONTHS_IN_SECONDS),
          apy: BigInt(TWELVE_MONTHS_APY),
        });
        const stakeRecord = await staking.getStake(stakeId);
        expect(estimatedEarnings.predictedEarningsInTokens).to.equal(expectedStakeEarnings.expectedEarningsInTokens);
        expect(estimatedEarnings.predictedEarningsPercentage).to.equal(expectedStakeEarnings.expectedEarningsPercentage);
        expect(stakeRecord.earningsInTokens).to.equal(estimatedEarnings.predictedEarningsInTokens);
        expect(stakeRecord.earningsPercentage).to.equal(estimatedEarnings.predictedEarningsPercentage);
      });

      it("should return 0 if the amount if zero", async function () {
        const estimatedEarnings = await staking.estimateStakeEarnings(ZERO_AMOUNT, oneMonthStakingPlanId);
        expect(estimatedEarnings.predictedEarningsInTokens).to.equal(0);
        expect(estimatedEarnings.predictedEarningsPercentage).to.equal(0);
      });

      it("should revert if the staking plan does not exist", async function () {
        await expect(staking.estimateStakeEarnings(QUARTER_STAKING_AMOUNT, NON_EXISTING_PLAN_ID))
          .to.be.revertedWithCustomError(stakingManagement, "StakingPlanDoesNotExist")
      });

      it("should revert when stake does not exist", async function () {
        await expect(staking.calculateStakeEarnings(NON_EXISTING_STAKE_ID)).to.be.revertedWithCustomError(
          staking,
          "StakeDoesNotExist"
        );
      });
    });

    describe("getStakes", function () {
      it("should return empty array if 0 offset and 0 limit", async function () {
        const staker1Address = await staker1.getAddress();
        const allStakerStakes = await staking.getStakes(staker1Address, 0, 0);
        expect(allStakerStakes.length).to.equal(0);
      });

      it("should return empty array if staker has no stakes", async function () {
        const staker1Address = await staker1.getAddress();
        const allStakerStakes = await staking.getStakes(staker1Address, 0, 100);
        expect(allStakerStakes.length).to.equal(0);
      });

      it("should return all stakes for a staker", async function () {
        const staker1Address = await staker1.getAddress();
        await staking.connect(staker1).stake(QUARTER_STAKING_AMOUNT, oneMonthStakingPlanId);
        await staking.connect(staker1).stake(QUARTER_STAKING_AMOUNT, threeMonthsStakingPlanId);
        await staking.connect(staker1).stake(QUARTER_STAKING_AMOUNT, sixMonthsStakingPlanId);
        await staking.connect(staker1).stake(QUARTER_STAKING_AMOUNT, twelveMonthsStakingPlanId);

        const allStakerStakes = await staking.getStakes(staker1Address, 0, 4);
        expect(allStakerStakes.length).to.equal(4);
      });

      it("should return correct amount with offset", async function () {
        const staker1Address = await staker1.getAddress();
        await staking.connect(staker1).stake(QUARTER_STAKING_AMOUNT, oneMonthStakingPlanId);
        await staking.connect(staker1).stake(QUARTER_STAKING_AMOUNT, threeMonthsStakingPlanId);
        await staking.connect(staker1).stake(QUARTER_STAKING_AMOUNT, sixMonthsStakingPlanId);
        await staking.connect(staker1).stake(QUARTER_STAKING_AMOUNT, twelveMonthsStakingPlanId);

        const allStakerStakes = await staking.getStakes(staker1Address, 2, 4);
        expect(allStakerStakes.length).to.equal(2);
      });
    });

    describe("getAllStakes", function () {
      it("should return empty array if 0 offset and 0 limit", async function () {
        const allStakerStakes = await staking.getAllStakes(0, 0);
        expect(allStakerStakes.length).to.equal(0);
      });

      it("should return empty array if 0 offset and 0 limit", async function () {
        const allStakerStakes = await staking.getAllStakes(0, 100);
        expect(allStakerStakes.length).to.equal(0);
      });

      it("should return all stakes", async function () {
        await staking.connect(staker1).stake(QUARTER_STAKING_AMOUNT, oneMonthStakingPlanId);
        await staking.connect(staker1).stake(QUARTER_STAKING_AMOUNT, threeMonthsStakingPlanId);
        await staking.connect(staker1).stake(QUARTER_STAKING_AMOUNT, sixMonthsStakingPlanId);
        await staking.connect(staker1).stake(QUARTER_STAKING_AMOUNT, twelveMonthsStakingPlanId);
        await staking.connect(staker2).stake(QUARTER_STAKING_AMOUNT, oneMonthStakingPlanId);
        await staking.connect(staker2).stake(QUARTER_STAKING_AMOUNT, threeMonthsStakingPlanId);
        await staking.connect(staker2).stake(QUARTER_STAKING_AMOUNT, sixMonthsStakingPlanId);
        await staking.connect(staker2).stake(QUARTER_STAKING_AMOUNT, twelveMonthsStakingPlanId);
        await staking.connect(staker3).stake(QUARTER_STAKING_AMOUNT, oneMonthStakingPlanId);
        await staking.connect(staker3).stake(QUARTER_STAKING_AMOUNT, threeMonthsStakingPlanId);
        await staking.connect(staker3).stake(QUARTER_STAKING_AMOUNT, sixMonthsStakingPlanId);
        await staking.connect(staker3).stake(QUARTER_STAKING_AMOUNT, twelveMonthsStakingPlanId);
        const allStakes = await staking.getAllStakes(0, 12);
        expect(allStakes.length).to.equal(12);
      });

      it("should return correct amount with offset", async function () {
        await staking.connect(staker1).stake(QUARTER_STAKING_AMOUNT, oneMonthStakingPlanId);
        await staking.connect(staker1).stake(QUARTER_STAKING_AMOUNT, threeMonthsStakingPlanId);
        await staking.connect(staker1).stake(QUARTER_STAKING_AMOUNT, sixMonthsStakingPlanId);
        await staking.connect(staker1).stake(QUARTER_STAKING_AMOUNT, twelveMonthsStakingPlanId);
        await staking.connect(staker2).stake(QUARTER_STAKING_AMOUNT, oneMonthStakingPlanId);
        await staking.connect(staker2).stake(QUARTER_STAKING_AMOUNT, threeMonthsStakingPlanId);
        await staking.connect(staker2).stake(QUARTER_STAKING_AMOUNT, sixMonthsStakingPlanId);
        await staking.connect(staker2).stake(QUARTER_STAKING_AMOUNT, twelveMonthsStakingPlanId);
        await staking.connect(staker3).stake(QUARTER_STAKING_AMOUNT, oneMonthStakingPlanId);
        await staking.connect(staker3).stake(QUARTER_STAKING_AMOUNT, threeMonthsStakingPlanId);
        await staking.connect(staker3).stake(QUARTER_STAKING_AMOUNT, sixMonthsStakingPlanId);
        await staking.connect(staker3).stake(QUARTER_STAKING_AMOUNT, twelveMonthsStakingPlanId);
        const allStakes = await staking.getAllStakes(6, 12);
        expect(allStakes.length).to.equal(6);
      });
    });

    describe("getStakesCount", function () {
      it("should return the correct amount if staker has stakes", async function () {
        const staker1Address = await staker1.getAddress();
        await staking.connect(staker1).stake(QUARTER_STAKING_AMOUNT, oneMonthStakingPlanId);
        await staking.connect(staker1).stake(QUARTER_STAKING_AMOUNT, threeMonthsStakingPlanId);
        await staking.connect(staker1).stake(QUARTER_STAKING_AMOUNT, sixMonthsStakingPlanId);
        await staking.connect(staker1).stake(QUARTER_STAKING_AMOUNT, twelveMonthsStakingPlanId);

        const stakesCount = await staking.getStakesCount(staker1Address);
        expect(stakesCount).to.equal(4);
      });

      it("should return the correct amount if staker has no stakes", async function () {
        const staker1Address = await staker1.getAddress();
        const stakesCount = await staking.getStakesCount(staker1Address);
        expect(stakesCount).to.equal(0);
      });
    });

    describe("getAllStakesCount", function () {
      it("should return the correct amount if there are any stakes", async function () {
        await staking.connect(staker1).stake(QUARTER_STAKING_AMOUNT, oneMonthStakingPlanId);
        await staking.connect(staker1).stake(QUARTER_STAKING_AMOUNT, threeMonthsStakingPlanId);
        await staking.connect(staker1).stake(QUARTER_STAKING_AMOUNT, sixMonthsStakingPlanId);
        await staking.connect(staker1).stake(QUARTER_STAKING_AMOUNT, twelveMonthsStakingPlanId);

        const allStakesCount = await staking.getAllStakesCount();
        expect(allStakesCount).to.equal(4);
      });

      it("should return the correct amount if there is no stakes", async function () {
        const allStakesCount = await staking.getAllStakesCount();
        expect(allStakesCount).to.equal(0);
      });
    });

    describe("getStakeIds", function () {
      it("should return the correct ids if staker has any stakes", async function () {
        const staker1Address = await staker1.getAddress();
        const firstStakeId = await staking.connect(staker1).stake.staticCall(QUARTER_STAKING_AMOUNT, oneMonthStakingPlanId);
        await staking.connect(staker1).stake(QUARTER_STAKING_AMOUNT, oneMonthStakingPlanId);
        const secondStakeId = await staking.connect(staker1).stake.staticCall(QUARTER_STAKING_AMOUNT, threeMonthsStakingPlanId);
        await staking.connect(staker1).stake(QUARTER_STAKING_AMOUNT, threeMonthsStakingPlanId);
        const thirdStakeId = await staking.connect(staker1).stake.staticCall(QUARTER_STAKING_AMOUNT, sixMonthsStakingPlanId);
        await staking.connect(staker1).stake(QUARTER_STAKING_AMOUNT, sixMonthsStakingPlanId);
        const fourthStakeId = await staking.connect(staker1).stake.staticCall(QUARTER_STAKING_AMOUNT, twelveMonthsStakingPlanId);
        await staking.connect(staker1).stake(QUARTER_STAKING_AMOUNT, twelveMonthsStakingPlanId);

        const stakeIds = await staking.getStakeIds(staker1Address);
        expect(stakeIds).to.have.lengthOf(4);
        expect(stakeIds[0]).to.equal(firstStakeId);
        expect(stakeIds[1]).to.equal(secondStakeId);
        expect(stakeIds[2]).to.equal(thirdStakeId);
        expect(stakeIds[3]).to.equal(fourthStakeId);
      });

      it("should return the empty array if staker has no stakes", async function () {
        const staker1Address = await staker1.getAddress();

        const stakeIds = await staking.getStakeIds(staker1Address);
        expect(stakeIds).to.have.lengthOf(0);
      });
    });

    describe("getAllStakeIds", function () {
      it("should return the correct ids if there are any stakes", async function () {
        const firstStakeId = await staking.connect(staker1).stake.staticCall(QUARTER_STAKING_AMOUNT, oneMonthStakingPlanId);
        await staking.connect(staker1).stake(QUARTER_STAKING_AMOUNT, oneMonthStakingPlanId);
        const secondStakeId = await staking.connect(staker2).stake.staticCall(QUARTER_STAKING_AMOUNT, threeMonthsStakingPlanId);
        await staking.connect(staker2).stake(QUARTER_STAKING_AMOUNT, threeMonthsStakingPlanId);
        const thirdStakeId = await staking.connect(staker3).stake.staticCall(QUARTER_STAKING_AMOUNT, sixMonthsStakingPlanId);
        await staking.connect(staker3).stake(QUARTER_STAKING_AMOUNT, sixMonthsStakingPlanId);

        const stakeIds = await staking.getAllStakeIds();
        expect(stakeIds).to.have.lengthOf(3);
        expect(stakeIds[0]).to.equal(firstStakeId);
        expect(stakeIds[1]).to.equal(secondStakeId);
        expect(stakeIds[2]).to.equal(thirdStakeId);
      });

      it("should return the empty array if no stakes", async function () {
        const stakeIds = await staking.getAllStakeIds();
        expect(stakeIds).to.have.lengthOf(0);
      });
    });

    describe("getStakedAmount", function () {
      it("should return the correct amount for all staker stakes and stake plans", async function () {
        const staker1Address = await staker1.getAddress();
        await staking.connect(staker1).stake(QUARTER_STAKING_AMOUNT, oneMonthStakingPlanId);
        await staking.connect(staker1).stake(QUARTER_STAKING_AMOUNT, threeMonthsStakingPlanId);
        await staking.connect(staker1).stake(QUARTER_STAKING_AMOUNT, sixMonthsStakingPlanId);
        await staking.connect(staker1).stake(QUARTER_STAKING_AMOUNT, twelveMonthsStakingPlanId);

        const stakedAmount = await staking.getStakedAmount(staker1Address);
        expect(stakedAmount).to.be.eq(STAKING_AMOUNT);
      });

      it("should return the correct amount if user has no stakes", async function () {
        const staker1Address = await staker1.getAddress();

        const stakedAmount = await staking.getStakedAmount(staker1Address);
        expect(stakedAmount).to.be.eq(ZERO_AMOUNT);
      });
    });

    describe("getTotalStaked", function () {
      it("should return correct amount if any stakes", async function () {
        await staking.connect(staker1).stake(QUARTER_STAKING_AMOUNT, oneMonthStakingPlanId);
        await staking.connect(staker2).stake(QUARTER_STAKING_AMOUNT, threeMonthsStakingPlanId);
        await staking.connect(staker3).stake(QUARTER_STAKING_AMOUNT, sixMonthsStakingPlanId);
        await staking.connect(staker4).stake(QUARTER_STAKING_AMOUNT, twelveMonthsStakingPlanId);

        const totalStaked = await staking.getTotalStaked();
        expect(totalStaked).to.be.eq(STAKING_AMOUNT);
      });

      it("should return correct amount if no stakes", async function () {
        const totalStaked = await staking.getTotalStaked();
        expect(totalStaked).to.be.eq(0);
      });
    });

    describe("calculateTotalEarnings", function () {
      it("should return the correct amount if staker has any stakes", async function () {
        const staker1Address = await staker1.getAddress();
        await staking.connect(staker1).stake(QUARTER_STAKING_AMOUNT, oneMonthStakingPlanId);
        await staking.connect(staker1).stake(QUARTER_STAKING_AMOUNT, threeMonthsStakingPlanId);
        await staking.connect(staker1).stake(QUARTER_STAKING_AMOUNT, sixMonthsStakingPlanId);
        await staking.connect(staker1).stake(QUARTER_STAKING_AMOUNT, twelveMonthsStakingPlanId);

        // await ethers.provider.send("evm_increaseTime", [TWELVE_MONTHS_IN_SECONDS]);
        await ethers.provider.send("evm_increaseTime", [86400 * 2]);
        await ethers.provider.send("evm_mine");

        const totalEarnings = await staking.calculateTotalEarnings(staker1Address);

        console.log('TOTAL EARNIGNS: ', totalEarnings);

        // const expectedTotalEarnings = calculateTotalExpectedEarnings([
        //   { stakingAmount: QUARTER_STAKING_AMOUNT, stakingPeriod: BigInt(ONE_MONTH_IN_SECONDS), apy: BigInt(ONE_MONTH_APY) },
        //   { stakingAmount: QUARTER_STAKING_AMOUNT, stakingPeriod: BigInt(THREE_MONTHS_IN_SECONDS), apy: BigInt(THREE_MONTHS_APY) },
        //   { stakingAmount: QUARTER_STAKING_AMOUNT, stakingPeriod: BigInt(SIX_MONTHS_IN_SECONDS), apy: BigInt(SIX_MONTHS_APY) },
        //   { stakingAmount: QUARTER_STAKING_AMOUNT, stakingPeriod: BigInt(TWELVE_MONTHS_IN_SECONDS), apy: BigInt(TWELVE_MONTHS_APY) },
        // ])

        // expect(totalEarnings.totalEarningsInTokens).to.be.eq(expectedTotalEarnings.expectedEarningsInTokens);
        // expect(totalEarnings.totalEarningsPercentage).to.be.eq(expectedTotalEarnings.expectedEarningsPercentage);
      });

      it("should return the correct amount if staker has no stakes", async function () {
        const staker1Address = await staker1.getAddress();
        const totalEarnings = await staking.calculateTotalEarnings(staker1Address);
        expect(totalEarnings.totalEarningsInTokens).to.be.eq(0);
        expect(totalEarnings.totalEarningsPercentage).to.be.eq(0);
      });
    });

    describe("isStakeExists", function () {
      it("should return true for existing stake", async function () {
        const stakeId = await staking.connect(staker1).stake.staticCall(QUARTER_STAKING_AMOUNT, oneMonthStakingPlanId);
        await staking.connect(staker1).stake(QUARTER_STAKING_AMOUNT, oneMonthStakingPlanId);
        const isStakeExists = await staking.isStakeExists(stakeId);
        expect(isStakeExists).to.be.true;
      });

      it("should return false for non-existing stake", async function () {
        const isStakeExists = await staking.isStakeExists(NON_EXISTING_STAKE_ID);
        expect(isStakeExists).to.be.false;
      });
    });

    describe("getStakesAmountPerPlan", function() {
      it("should return the correct amount for every plan", async function () {
        await staking.connect(staker1).stake(QUARTER_STAKING_AMOUNT, oneMonthStakingPlanId);
        await staking.connect(staker1).stake(QUARTER_STAKING_AMOUNT, threeMonthsStakingPlanId);
        await staking.connect(staker1).stake(QUARTER_STAKING_AMOUNT, sixMonthsStakingPlanId);
        await staking.connect(staker1).stake(QUARTER_STAKING_AMOUNT, twelveMonthsStakingPlanId);

        const firstPlanStakesAmount = await staking.getStakesAmountPerPlan(oneMonthStakingPlanId);
        const secondPlanStakesAmount = await staking.getStakesAmountPerPlan(threeMonthsStakingPlanId);
        const thirdPlanStakesAmount = await staking.getStakesAmountPerPlan(sixMonthsStakingPlanId);
        const fourthPlanStakesAmount = await staking.getStakesAmountPerPlan(twelveMonthsStakingPlanId);

        expect(firstPlanStakesAmount).to.be.eq(1);
        expect(secondPlanStakesAmount).to.be.eq(1);
        expect(thirdPlanStakesAmount).to.be.eq(1);
        expect(fourthPlanStakesAmount).to.be.eq(1);
      });

      it("should revert if plan does not exist", async function () {
        await expect(staking.getStakesAmountPerPlan(NON_EXISTING_PLAN_ID))
          .to.be.revertedWithCustomError(stakingManagement, "StakingPlanDoesNotExist")
      });
    });

    describe("getStakesPerPlan", function() {
      it("should return the correct stake data for every plan", async function () {
        await staking.connect(staker1).stake(QUARTER_STAKING_AMOUNT, oneMonthStakingPlanId);
        await staking.connect(staker1).stake(QUARTER_STAKING_AMOUNT, threeMonthsStakingPlanId);
        await staking.connect(staker1).stake(QUARTER_STAKING_AMOUNT, sixMonthsStakingPlanId);
        await staking.connect(staker1).stake(QUARTER_STAKING_AMOUNT, twelveMonthsStakingPlanId);

        const firstPlanStakes = await staking.getStakesPerPlan(oneMonthStakingPlanId, 0, 100);
        const secondPlanStakes = await staking.getStakesPerPlan(threeMonthsStakingPlanId, 0, 100);
        const thirdPlanStakes = await staking.getStakesPerPlan(sixMonthsStakingPlanId, 0, 100);
        const fourthPlanStakes = await staking.getStakesPerPlan(twelveMonthsStakingPlanId, 0, 100);

        expect(firstPlanStakes).to.have.lengthOf(1);
        expect(secondPlanStakes).to.have.lengthOf(1);
        expect(thirdPlanStakes).to.have.lengthOf(1);
        expect(fourthPlanStakes).to.have.lengthOf(1);
      });

      it("should revert if plan does not exist", async function () {
        await expect(staking.getStakesAmountPerPlan(NON_EXISTING_PLAN_ID))
          .to.be.revertedWithCustomError(stakingManagement, "StakingPlanDoesNotExist")
      });
    });

    describe("getStakingPoolSize", function() {
      it("should return the correct pool size after a couple of stakes", async function () {
        const stake1EsimatedEarnings = await staking.estimateStakeEarnings(QUARTER_STAKING_AMOUNT, oneMonthStakingPlanId);
        const stake2EsimatedEarnings = await staking.estimateStakeEarnings(QUARTER_STAKING_AMOUNT, threeMonthsStakingPlanId);
        const stake3EsimatedEarnings = await staking.estimateStakeEarnings(QUARTER_STAKING_AMOUNT, sixMonthsStakingPlanId);
        const stake4EsimatedEarnings = await staking.estimateStakeEarnings(QUARTER_STAKING_AMOUNT, twelveMonthsStakingPlanId);

        await staking.connect(staker1).stake(QUARTER_STAKING_AMOUNT, oneMonthStakingPlanId);
        await staking.connect(staker1).stake(QUARTER_STAKING_AMOUNT, threeMonthsStakingPlanId);
        await staking.connect(staker1).stake(QUARTER_STAKING_AMOUNT, sixMonthsStakingPlanId);
        await staking.connect(staker1).stake(QUARTER_STAKING_AMOUNT, twelveMonthsStakingPlanId);

        const allEarnings = stake1EsimatedEarnings.predictedEarningsInTokens +
          stake2EsimatedEarnings.predictedEarningsInTokens +
          stake3EsimatedEarnings.predictedEarningsInTokens +
          stake4EsimatedEarnings.predictedEarningsInTokens;
        const expectedPoolSize = STAKING_AMOUNT + allEarnings;
        const stakingPoolSize = await staking.getStakingPoolSize();

        expect(stakingPoolSize).to.be.eq(expectedPoolSize);
      });

      it("should return the correct pool size after a couple of stakes and withdrawals", async function () {
        let stakingPoolSize = await staking.getStakingPoolSize();

        const stake1EsimatedEarnings = await staking.estimateStakeEarnings(QUARTER_STAKING_AMOUNT, oneMonthStakingPlanId);
        const stake2EsimatedEarnings = await staking.estimateStakeEarnings(QUARTER_STAKING_AMOUNT, threeMonthsStakingPlanId);
        const stake3EsimatedEarnings = await staking.estimateStakeEarnings(QUARTER_STAKING_AMOUNT, sixMonthsStakingPlanId);
        const stake4EsimatedEarnings = await staking.estimateStakeEarnings(QUARTER_STAKING_AMOUNT, twelveMonthsStakingPlanId);

        const stakeId1 = await staking.connect(staker1).stake.staticCall(QUARTER_STAKING_AMOUNT, oneMonthStakingPlanId);
        await staking.connect(staker1).stake(QUARTER_STAKING_AMOUNT, oneMonthStakingPlanId);
        const stakeId2 = await staking.connect(staker1).stake.staticCall(QUARTER_STAKING_AMOUNT, threeMonthsStakingPlanId);
        await staking.connect(staker1).stake(QUARTER_STAKING_AMOUNT, threeMonthsStakingPlanId);
        const stakeId3 = await staking.connect(staker1).stake.staticCall(QUARTER_STAKING_AMOUNT, sixMonthsStakingPlanId);
        await staking.connect(staker1).stake(QUARTER_STAKING_AMOUNT, sixMonthsStakingPlanId);
        const stakeId4 = await staking.connect(staker1).stake.staticCall(QUARTER_STAKING_AMOUNT, twelveMonthsStakingPlanId);
        await staking.connect(staker1).stake(QUARTER_STAKING_AMOUNT, twelveMonthsStakingPlanId);

        const allEarnings = stake1EsimatedEarnings.predictedEarningsInTokens +
          stake2EsimatedEarnings.predictedEarningsInTokens +
          stake3EsimatedEarnings.predictedEarningsInTokens +
          stake4EsimatedEarnings.predictedEarningsInTokens;
        const expectedPoolSize = STAKING_AMOUNT + allEarnings;
        stakingPoolSize = await staking.getStakingPoolSize();

        expect(stakingPoolSize).to.be.eq(expectedPoolSize);

        await ethers.provider.send("evm_increaseTime", [TWELVE_MONTHS_IN_SECONDS]);
        await ethers.provider.send("evm_mine");

        await staking.connect(staker1).withdraw(stakeId1);
        stakingPoolSize = await staking.getStakingPoolSize();
        const stake1AmountWithEarnings = QUARTER_STAKING_AMOUNT + stake1EsimatedEarnings.predictedEarningsInTokens;
        expect(stakingPoolSize).to.be.eq(expectedPoolSize - stake1AmountWithEarnings);

        await staking.connect(staker1).withdraw(stakeId2);
        stakingPoolSize = await staking.getStakingPoolSize();
        const stake2AmountWithEarnings = QUARTER_STAKING_AMOUNT + stake2EsimatedEarnings.predictedEarningsInTokens;
        expect(stakingPoolSize).to.be.eq(expectedPoolSize - stake1AmountWithEarnings - stake2AmountWithEarnings);

        await staking.connect(staker1).withdraw(stakeId3);
        stakingPoolSize = await staking.getStakingPoolSize();
        const stake3AmountWithEarnings = QUARTER_STAKING_AMOUNT + stake3EsimatedEarnings.predictedEarningsInTokens;
        expect(stakingPoolSize).to.be.eq(expectedPoolSize - stake1AmountWithEarnings - stake2AmountWithEarnings - stake3AmountWithEarnings);

        await staking.connect(staker1).withdraw(stakeId4);
        stakingPoolSize = await staking.getStakingPoolSize();
        const stake4AmountWithEarnings = QUARTER_STAKING_AMOUNT + stake4EsimatedEarnings.predictedEarningsInTokens;
        expect(stakingPoolSize).to.be.eq(expectedPoolSize - stake1AmountWithEarnings - stake2AmountWithEarnings - stake3AmountWithEarnings - stake4AmountWithEarnings);
        expect(stakingPoolSize).to.be.eq(0);
      });

      it("should return zero if no stakes", async function () {
        const stakingPoolSize = await staking.getStakingPoolSize();
        expect(stakingPoolSize).to.be.eq(0);
      });
    });
  });
});

export type ExpectedEarningsResult = {
  expectedEarningsInTokens: bigint,
  expectedEarningsPercentage: bigint,
  expectedBalance: bigint,
};

export type StakeData = {
  stakingAmount: bigint,
  stakingPeriod: bigint,
  apy: bigint
}

export function calculateExpectedEarnings(stake: StakeData): ExpectedEarningsResult {
  const SECONDS_IN_DAY = 24 * 60 * 60;
  const DAYS_IN_YEAR = 365;
  const HUNDRED_PERCENT = 100_00; // Basis points for APY
  const PRECISION_FACTOR = BigInt(1e18);
  const dailyRate = (stake.apy * PRECISION_FACTOR) / BigInt(HUNDRED_PERCENT) / BigInt(DAYS_IN_YEAR);
  const totalCompoundingPeriods = stake.stakingPeriod / BigInt(SECONDS_IN_DAY);

  let compoundedBalance = stake.stakingAmount * PRECISION_FACTOR;
  for (let i = 0n; i < totalCompoundingPeriods; i++) {
    compoundedBalance += (compoundedBalance * dailyRate) / PRECISION_FACTOR;
  }

  const earningsInTokens = (compoundedBalance / PRECISION_FACTOR) - stake.stakingAmount;
  const earningsPercentage = (earningsInTokens * BigInt(HUNDRED_PERCENT) * PRECISION_FACTOR) / (stake.stakingAmount * PRECISION_FACTOR) * BigInt(10000);

  return {
    expectedEarningsInTokens: earningsInTokens,
    expectedEarningsPercentage: earningsPercentage / BigInt(10000), // Convert back from basis points to percentage
    expectedBalance: earningsInTokens + stake.stakingAmount
  };
}

export function calculateTotalExpectedEarnings(stakes: StakeData[]): ExpectedEarningsResult {
  let totalEarningsInTokens = 0n;
  let totalWeightedPercentage = 0n;
  let totalStaked = 0n;

  stakes.forEach((stake) => {
    totalStaked += stake.stakingAmount;
    const earningsResult = calculateExpectedEarnings(stake);
    totalEarningsInTokens += earningsResult.expectedEarningsInTokens;
    totalWeightedPercentage += (earningsResult.expectedEarningsPercentage * earningsResult.expectedEarningsInTokens) / 10000n;
  });

  let totalEarningsPercentage = 0n;
  if (totalEarningsInTokens > 0n) {
    totalEarningsPercentage = (totalWeightedPercentage * 10000n) / totalEarningsInTokens;
  }

  let expectedBalance = totalStaked + totalEarningsInTokens;

  return {
    expectedEarningsInTokens: totalEarningsInTokens,
    expectedEarningsPercentage: totalEarningsPercentage,
    expectedBalance: expectedBalance,
  };
};
