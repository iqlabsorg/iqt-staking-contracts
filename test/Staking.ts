import { expect } from "chai";
import { ethers, run } from "hardhat";
import { BigNumberish, Signer, formatUnits } from "ethers";
import { StakingManagement, Staking, IQTMock } from "../typechain";

describe("Staking Contract", function () {
  let deployer: Signer;
  let stranger: Signer;
  let staker1: Signer;
  let staker2: Signer;
  let staker3: Signer;
  let stakingPool: Signer;
  let stakingToken: IQTMock;
  let staking: Staking;
  let stakingManagement: StakingManagement;

  const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

  beforeEach(async function () {
    const accounts = await ethers.getSigners();

    deployer = accounts[0];
    stranger = accounts[1];
    staker1 = accounts[2];
    staker2 = accounts[3];
    staker3 = accounts[4];
    stakingPool = accounts[5];

    const deployerAddress = await deployer.getAddress();
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

    await stakingToken.connect(stakingPool).approve(staking.target, ethers.parseEther('1000000'));
  });

  describe("Deployment", function () {
    it("Should set the correct StakingManagement address", async function () {
      expect(await staking.getStakingManagement()).to.equal(stakingManagement.target);
    });

    it("Should set the correct StakingToken address", async function () {
      expect(await staking.getStakingToken()).to.equal(stakingToken.target);
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
        oneMonthStakingPlanId = await stakingManagement.addStakingPlan.staticCall(ONE_MONTH_IN_SECONDS, ONE_MONTH_APY);
        await stakingManagement.connect(deployer).addStakingPlan(ONE_MONTH_IN_SECONDS, ONE_MONTH_APY);
        threeMonthsStakingPlanId = await stakingManagement.addStakingPlan.staticCall(THREE_MONTHS_IN_SECONDS, THREE_MONTHS_APY);
        await stakingManagement.connect(deployer).addStakingPlan(THREE_MONTHS_IN_SECONDS, THREE_MONTHS_APY);
        sixMonthsStakingPlanId = await stakingManagement.addStakingPlan.staticCall(SIX_MONTHS_IN_SECONDS, SIX_MONTHS_APY);
        await stakingManagement.connect(deployer).addStakingPlan(SIX_MONTHS_IN_SECONDS, SIX_MONTHS_APY);
        twelveMonthsStakingPlanId = await stakingManagement.addStakingPlan.staticCall(TWELVE_MONTHS_IN_SECONDS, TWELVE_MONTHS_APY);
        await stakingManagement.connect(deployer).addStakingPlan(TWELVE_MONTHS_IN_SECONDS, TWELVE_MONTHS_APY);

        await stakingManagement.connect(deployer).setStakingLimits(QUARTER_STAKING_AMOUNT, QUARTER_STAKING_AMOUNT);
      });

      it("should stake", async function () {
        await expect(staking.connect(staker1).stake(QUARTER_STAKING_AMOUNT, oneMonthStakingPlanId)).to.not.be.reverted;
      });

      it("should emit an event when staking", async function () {
        const staker1Address = await staker1.getAddress();
        const expectedStakeId = await staking.connect(staker1).stake.staticCall(QUARTER_STAKING_AMOUNT, oneMonthStakingPlanId)
        await expect(staking.connect(staker1).stake(QUARTER_STAKING_AMOUNT, oneMonthStakingPlanId))
          .to.emit(staking, "StakeAdded")
          .withArgs(staker1Address, expectedStakeId);
      });

      it("should allow me to stake and withdraw with all different staking plans", async function () {
        await stakingManagement.connect(deployer).setStakingLimits(QUARTER_STAKING_AMOUNT, QUARTER_STAKING_AMOUNT);
        const firstStakeId = await staking.connect(staker1).stake.staticCall(QUARTER_STAKING_AMOUNT, oneMonthStakingPlanId);
        await staking.connect(staker1).stake(QUARTER_STAKING_AMOUNT, oneMonthStakingPlanId);
        const secondStakeId = await staking.connect(staker1).stake.staticCall(QUARTER_STAKING_AMOUNT, threeMonthsStakingPlanId);
        await staking.connect(staker1).stake(QUARTER_STAKING_AMOUNT, threeMonthsStakingPlanId);
        const thirdStakeId = await staking.connect(staker1).stake.staticCall(QUARTER_STAKING_AMOUNT, sixMonthsStakingPlanId);
        await staking.connect(staker1).stake(QUARTER_STAKING_AMOUNT, sixMonthsStakingPlanId);
        const fourthStakeId = await staking.connect(staker1).stake.staticCall(QUARTER_STAKING_AMOUNT, twelveMonthsStakingPlanId);
        await staking.connect(staker1).stake(QUARTER_STAKING_AMOUNT, twelveMonthsStakingPlanId);
        const staker1Address = await staker1.getAddress();

        await ethers.provider.send("evm_increaseTime", [TWELVE_MONTHS_IN_SECONDS]);
        await ethers.provider.send("evm_mine");
        await staking.connect(staker1).withdraw(firstStakeId);
        const firstStakeEarnings = await staking.calculateStakeEarnings(firstStakeId);

        const staker1BalanceAfterFirstWithdrawal = await stakingToken.balanceOf(staker1Address);
        const expectedFirstStakeEarnings = calculateExpectedEarnings({
          stakingAmount: QUARTER_STAKING_AMOUNT,
          stakingPeriod: BigInt(ONE_MONTH_IN_SECONDS),
          apy: BigInt(ONE_MONTH_APY),
        });

        expect(firstStakeEarnings.earningsInTokens).to.equal(expectedFirstStakeEarnings.expectedEarningsInTokens);
        expect(firstStakeEarnings.earningsPercentage).to.equal(expectedFirstStakeEarnings.expectedEarningsPercentage);
        expect(staker1BalanceAfterFirstWithdrawal).to.equal(expectedFirstStakeEarnings.expectedBalance);

        const firstStake = await staking.getStake(firstStakeId);
        expect(firstStake.staker).to.equal(staker1Address);
        expect(firstStake.amount).to.equal(QUARTER_STAKING_AMOUNT);
        expect(firstStake.stakingPlanId).to.equal(oneMonthStakingPlanId);
        expect(firstStake.earningsInTokens).to.equal(expectedFirstStakeEarnings.expectedEarningsInTokens);
        expect(firstStake.earningsPercentage).to.equal(expectedFirstStakeEarnings.expectedEarningsPercentage);
        expect(firstStake.earlyWithdrawal).to.equal(false);
        expect(firstStake.withdrawn).to.equal(true);

        await ethers.provider.send("evm_increaseTime", [THREE_MONTHS_IN_SECONDS - ONE_MONTH_IN_SECONDS]);
        await ethers.provider.send("evm_mine");

        await staking.connect(staker1).withdraw(secondStakeId);
        const secondStakeEarnings = await staking.calculateStakeEarnings(secondStakeId);
        const staker1BalanceAfterSecondWithdrawal = await stakingToken.balanceOf(staker1Address);
        const expectedSecondStakeEarnings = calculateExpectedEarnings({
          stakingAmount: QUARTER_STAKING_AMOUNT,
          stakingPeriod: BigInt(THREE_MONTHS_IN_SECONDS),
          apy: BigInt(THREE_MONTHS_APY),
        });

        expect(secondStakeEarnings.earningsInTokens).to.equal(expectedSecondStakeEarnings.expectedEarningsInTokens);
        expect(secondStakeEarnings.earningsPercentage).to.equal(expectedSecondStakeEarnings.expectedEarningsPercentage);
        expect(staker1BalanceAfterSecondWithdrawal).to.equal(
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

        await ethers.provider.send("evm_increaseTime", [SIX_MONTHS_IN_SECONDS - THREE_MONTHS_IN_SECONDS]);
        await ethers.provider.send("evm_mine");

        await staking.connect(staker1).withdraw(thirdStakeId);
        const thirdStakeEarnings = await staking.calculateStakeEarnings(thirdStakeId);
        const staker1BalanceAfterThirdWithdrawal = await stakingToken.balanceOf(staker1Address);
        const expectedThirdStakeEarnings = calculateExpectedEarnings({
          stakingAmount: QUARTER_STAKING_AMOUNT,
          stakingPeriod: BigInt(SIX_MONTHS_IN_SECONDS),
          apy: BigInt(SIX_MONTHS_APY),
        });

        expect(thirdStakeEarnings.earningsInTokens).to.equal(expectedThirdStakeEarnings.expectedEarningsInTokens);
        expect(thirdStakeEarnings.earningsPercentage).to.equal(expectedThirdStakeEarnings.expectedEarningsPercentage);
        expect(staker1BalanceAfterThirdWithdrawal).to.equal(
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

        await ethers.provider.send("evm_increaseTime", [TWELVE_MONTHS_IN_SECONDS - SIX_MONTHS_IN_SECONDS]);
        await ethers.provider.send("evm_mine");

        await staking.connect(staker1).withdraw(fourthStakeId);
        const fourthStakeEarnings = await staking.calculateStakeEarnings(fourthStakeId);
        const staker1BalanceAfterFourthWithdrawal = await stakingToken.balanceOf(staker1Address);
        const expectedFourthStakeEarnings = calculateExpectedEarnings({
          stakingAmount: QUARTER_STAKING_AMOUNT,
          stakingPeriod: BigInt(TWELVE_MONTHS_IN_SECONDS),
          apy: BigInt(TWELVE_MONTHS_APY),
        });

        expect(fourthStakeEarnings.earningsInTokens).to.equal(expectedFourthStakeEarnings.expectedEarningsInTokens);
        expect(fourthStakeEarnings.earningsPercentage).to.equal(expectedFourthStakeEarnings.expectedEarningsPercentage);
        expect(staker1BalanceAfterFourthWithdrawal).to.equal(
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

        expect(staker1BalanceAfterFourthWithdrawal).to.equal(totalExpectedEarnings.expectedBalance);
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

      it("should revert when allowance is not given to staking contract", async function () {
        await stakingToken.connect(staker1).approve(staking.target, 0);
        await expect(staking.connect(staker1).stake(QUARTER_STAKING_AMOUNT, oneMonthStakingPlanId)).to.be.revertedWithCustomError(
          staking, "InsufficientAllowance"
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
        await stakingToken.connect(deployer).transfer(staker1Address, STAKING_AMOUNT);
        await stakingToken.connect(staker1).approve(staking.target, STAKING_AMOUNT);
        oneMonthStakingPlanId = await stakingManagement.addStakingPlan.staticCall(ONE_MONTH_IN_SECONDS, ONE_MONTH_APY);
        await stakingManagement.connect(deployer).addStakingPlan(ONE_MONTH_IN_SECONDS, ONE_MONTH_APY);
        await stakingManagement.connect(deployer).setStakingLimits(QUARTER_STAKING_AMOUNT, QUARTER_STAKING_AMOUNT);
      });

      it("should withdraw", async function () {
        const stakeId = await staking.connect(staker1).stake.staticCall(QUARTER_STAKING_AMOUNT, oneMonthStakingPlanId);
        await staking.connect(staker1).stake(QUARTER_STAKING_AMOUNT, oneMonthStakingPlanId);
        await ethers.provider.send("evm_increaseTime", [ONE_MONTH_IN_SECONDS]);
        await ethers.provider.send("evm_mine");
        await expect(staking.connect(staker1).withdraw(stakeId)).to.not.be.reverted;
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

      it("should revert when stake does not exist", async function () {
        await expect(staking.connect(staker1).withdraw(NON_EXISTING_STAKE_ID)).to.be.revertedWithCustomError(
          staking,
          "StakeDoesNotExist"
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

      it("should revert when stake is not matured", async function () {
        const stakeId = await staking.connect(staker1).stake.staticCall(QUARTER_STAKING_AMOUNT, oneMonthStakingPlanId);
        await staking.connect(staker1).stake(QUARTER_STAKING_AMOUNT, oneMonthStakingPlanId);
        await expect(staking.connect(staker1).withdraw(stakeId)).to.be.revertedWithCustomError(
          staking,
          "EarlyWithdrawalNotAllowed"
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
      await stakingToken.connect(deployer).transfer(staker1Address, STAKING_AMOUNT);
      await stakingToken.connect(staker1).approve(staking.target, STAKING_AMOUNT);
      await stakingToken.connect(deployer).transfer(staker2Address, STAKING_AMOUNT);
      await stakingToken.connect(staker2).approve(staking.target, STAKING_AMOUNT);
      await stakingToken.connect(deployer).transfer(staker3Address, STAKING_AMOUNT);
      await stakingToken.connect(staker3).approve(staking.target, STAKING_AMOUNT);
      oneMonthStakingPlanId = await stakingManagement.addStakingPlan.staticCall(ONE_MONTH_IN_SECONDS, ONE_MONTH_APY);
      await stakingManagement.connect(deployer).addStakingPlan(ONE_MONTH_IN_SECONDS, ONE_MONTH_APY);
      threeMonthsStakingPlanId = await stakingManagement.addStakingPlan.staticCall(THREE_MONTHS_IN_SECONDS, THREE_MONTHS_APY);
      await stakingManagement.connect(deployer).addStakingPlan(THREE_MONTHS_IN_SECONDS, THREE_MONTHS_APY);
      sixMonthsStakingPlanId = await stakingManagement.addStakingPlan.staticCall(SIX_MONTHS_IN_SECONDS, SIX_MONTHS_APY);
      await stakingManagement.connect(deployer).addStakingPlan(SIX_MONTHS_IN_SECONDS, SIX_MONTHS_APY);
      twelveMonthsStakingPlanId = await stakingManagement.addStakingPlan.staticCall(TWELVE_MONTHS_IN_SECONDS, TWELVE_MONTHS_APY);
      await stakingManagement.connect(deployer).addStakingPlan(TWELVE_MONTHS_IN_SECONDS, TWELVE_MONTHS_APY);
      await stakingManagement.connect(deployer).setStakingLimits(QUARTER_STAKING_AMOUNT, QUARTER_STAKING_AMOUNT);
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
      it("should return the correct stake earnings", async function () {
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

      it("should revert when stake does not exist", async function () {
        await expect(staking.calculateStakeEarnings(NON_EXISTING_STAKE_ID)).to.be.revertedWithCustomError(
          staking,
          "StakeDoesNotExist"
        );
      });
    });

    describe("getAllStakes", function () {
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
    });

    describe("getStakes", function () {
      it("should return all stakes for a staker", async function () {
        const staker1Address = await staker1.getAddress();
        await staking.connect(staker1).stake(QUARTER_STAKING_AMOUNT, oneMonthStakingPlanId);
        await staking.connect(staker1).stake(QUARTER_STAKING_AMOUNT, threeMonthsStakingPlanId);
        await staking.connect(staker1).stake(QUARTER_STAKING_AMOUNT, sixMonthsStakingPlanId);
        await staking.connect(staker1).stake(QUARTER_STAKING_AMOUNT, twelveMonthsStakingPlanId);

        const allStakerStakes = await staking.getStakes(staker1Address, 0, 4);
        expect(allStakerStakes.length).to.equal(4);
      });
    });

    describe("getStakedAmount", function () {
      it("should return correct amount", async function () {
        const staker1Address = await staker1.getAddress();
        await staking.connect(staker1).stake(QUARTER_STAKING_AMOUNT, oneMonthStakingPlanId);
        await staking.connect(staker1).stake(QUARTER_STAKING_AMOUNT, threeMonthsStakingPlanId);
        await staking.connect(staker1).stake(QUARTER_STAKING_AMOUNT, sixMonthsStakingPlanId);
        await staking.connect(staker1).stake(QUARTER_STAKING_AMOUNT, twelveMonthsStakingPlanId);

        const stakerStakedAmount = await staking.getStakedAmount(staker1Address);
        expect(stakerStakedAmount).to.equal(STAKING_AMOUNT);
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
  const MAX_APY = 100_00; // Basis points for APY
  const PRECISION_FACTOR = BigInt(1e18);
  const dailyRate = (stake.apy * PRECISION_FACTOR) / BigInt(MAX_APY) / BigInt(DAYS_IN_YEAR);
  const totalCompoundingPeriods = stake.stakingPeriod / BigInt(SECONDS_IN_DAY);

  let compoundedBalance = stake.stakingAmount * PRECISION_FACTOR;
  for (let i = 0n; i < totalCompoundingPeriods; i++) {
    compoundedBalance += (compoundedBalance * dailyRate) / PRECISION_FACTOR;
  }

  const earningsInTokens = (compoundedBalance / PRECISION_FACTOR) - stake.stakingAmount;
  const earningsPercentage = (earningsInTokens * BigInt(MAX_APY) * PRECISION_FACTOR) / (stake.stakingAmount * PRECISION_FACTOR) * BigInt(10000);

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
