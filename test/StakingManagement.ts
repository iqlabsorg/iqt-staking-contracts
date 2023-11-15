import { expect } from "chai";
import { ethers, run } from "hardhat";
import { BigNumberish, Signer, id } from "ethers";
import { StakingManagement, IQTMock, Staking } from "../typechain";

export const solidityIdBytes32 = (string: string): string => {
  return id(string);
};

describe("StakingManagement Contract", function () {
  let deployer: Signer;
  let stakingManager: Signer;
  let staker1: Signer;
  let staker2: Signer;
  let stranger: Signer;
  let stakingPool: Signer;
  let staking: Staking;
  let stakingToken: IQTMock;
  let stakingManagement: StakingManagement;

  const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
  const STAKING_MANAGER_ROLE = solidityIdBytes32("STAKING_MANAGER");
  const STAKER_BALANCE = 10000;

  beforeEach(async function () {
    const accounts = await ethers.getSigners();

    deployer = accounts[0];
    stakingManager = accounts[1];
    staker1 = accounts[2];
    staker2 = accounts[3];
    stranger = accounts[4];
    stakingPool = accounts[5];

    const deployerAddress = await deployer.getAddress();
    const stakingManagerAddress = await deployer.getAddress();
    const stakingPoolAddress = await stakingPool.getAddress();

    stakingToken = (await run("deploy:iqt-mock", { mintTo: deployerAddress })) as IQTMock;
    stakingManagement = (await run("deploy:staking-management", {
      stakingToken: stakingToken.target,
    })) as StakingManagement;
    staking = (await run("deploy:staking", {
      stakingManagement: stakingManagement.target,
      stakingPool: stakingPoolAddress
    })) as Staking;

    await stakingManagement.connect(deployer).setStaking(staking.target);
    await stakingManagement.connect(deployer).grantRole(STAKING_MANAGER_ROLE, stakingManagerAddress);
    await stakingToken.connect(deployer).transfer(staker1.getAddress(), STAKER_BALANCE);
    await stakingToken.connect(deployer).transfer(staker2.getAddress(), STAKER_BALANCE);
  });

  describe("Deployment", function () {
    it("Should deploy the StakingManagement contract", async function () {
      expect(stakingManagement.target).to.not.equal(ZERO_ADDRESS);
    });

    it("Should set the staking token address", async function () {
      expect(await stakingManagement.getStakingToken()).to.equal(stakingToken.target);
    });

    it("Should set the owner address", async function () {
      const deployerAddress = await deployer.getAddress();
      const defaultAdminRole = await stakingManagement.DEFAULT_ADMIN_ROLE();
      expect(await stakingManagement.hasRole(defaultAdminRole, deployerAddress)).to.equal(true);
      expect(await stakingManagement.hasRole(STAKING_MANAGER_ROLE, deployerAddress)).to.equal(true);
    });
  });

  describe("Functionality", function () {
    /** APYs */
    const ZERO_PERCENT = 0;
    const HUNDRED_PERCENT = 100_00;
    const HUNDED_ONE_PERCENT = 100_01;
    const ONE_MONTH_APY = 10_00;
    const THREE_MONTHS_APY = 12_00;
    const SIX_MONTHS_APY = 14_00;
    const TWELVE_MONTHS_APY = 18_00;
    /** Time Frames */
    const ZERO_SECONDS = 0;
    const ONE_MONTH_IN_SECONDS = 2629746;
    const THREE_MONTHS_IN_SECONDS = 7889238;
    const SIX_MONTHS_IN_SECONDS = 15778476;
    const TWELVE_MONTHS_IN_SECONDS = 31556952;
    /** Staking amounts */
    const STAKING_AMOUNT = 1000;

    describe("addStakingPlan", function () {
      beforeEach(async function () {
        const stakingManagerAddress = await stakingManager.getAddress();
        await stakingManagement.connect(deployer).grantRole(STAKING_MANAGER_ROLE, stakingManagerAddress);
      })

      it("Should add a staking plan", async function () {
        await stakingManagement.connect(deployer).addStakingPlan(ONE_MONTH_IN_SECONDS, ONE_MONTH_APY);
        expect(await stakingManagement.getStakingPlansAmount()).to.equal(1);
      });

      it('Should add a staking plan as a STAKING_MANAGER', async function () {
        await stakingManagement.connect(stakingManager).addStakingPlan(ONE_MONTH_IN_SECONDS, ONE_MONTH_APY);
        expect(await stakingManagement.getStakingPlansAmount()).to.equal(1);
      });

      it('Should not allow to add without STAKING_MANAGER role', async function () {
        await expect(stakingManagement.connect(stranger).addStakingPlan(ONE_MONTH_IN_SECONDS, ONE_MONTH_APY))
          .to.be.revertedWithCustomError(stakingManagement, "CallerIsNotAStakingManager");
      });

      it("Should not allow to add a staking plan with the 0 duration", async function () {
        await expect(stakingManagement.addStakingPlan(ZERO_SECONDS, ONE_MONTH_APY)).to.be.revertedWithCustomError(stakingManagement, "DurationMustBeGreaterThanZero");
      });

      it("Should not allow to add a staking plan with the 0% APY", async function () {
        await expect(stakingManagement.addStakingPlan(ONE_MONTH_IN_SECONDS, ZERO_PERCENT)).to.be.revertedWithCustomError(stakingManagement, "APYMustBeWithinRange");
      });

      it("Should not allow to add a staking plan with more the 100% APY", async function () {
        await expect(stakingManagement.addStakingPlan(ONE_MONTH_IN_SECONDS, HUNDED_ONE_PERCENT)).to.be.revertedWithCustomError(stakingManagement, "APYMustBeWithinRange");
      });
    });

    describe("removeStakingPlan", function () {
      const NON_EXISTING_PLAN_ID = 999;
      let planId: BigNumberish;

      beforeEach(async function () {
        planId = await stakingManagement.addStakingPlan.staticCall(ONE_MONTH_IN_SECONDS, ONE_MONTH_APY);
        await stakingManagement.connect(deployer).addStakingPlan(ONE_MONTH_IN_SECONDS, ONE_MONTH_APY);
        const stakingManagerAddress = await stakingManager.getAddress();
        await stakingManagement.connect(deployer).grantRole(STAKING_MANAGER_ROLE, stakingManagerAddress);
      });

      it("Should remove a staking plan", async function () {
        await stakingManagement.connect(deployer).removeStakingPlan(planId);
        expect(await stakingManagement.getStakingPlansAmount()).to.equal(0);
      });

      it("Should remove a staking plan as a STAKING_MANAGER", async function () {
        await stakingManagement.connect(stakingManager).removeStakingPlan(planId);
        expect(await stakingManagement.getStakingPlansAmount()).to.equal(0);
      });

      it ("Should not allow to remove a staking plan twice", async function () {
        await stakingManagement.connect(deployer).removeStakingPlan(planId);
        await expect(stakingManagement.removeStakingPlan(planId))
          .to.be.revertedWithCustomError(stakingManagement, "StakingPlanDoesNotExist");
      })

      it("Should not allow to remove a staking plan if there are active stakes", async function () {
        let planId: BigNumberish;
        planId = await stakingManagement.addStakingPlan.staticCall(ONE_MONTH_IN_SECONDS, ONE_MONTH_APY);
        await stakingManagement.connect(deployer).addStakingPlan(ONE_MONTH_IN_SECONDS, ONE_MONTH_APY);
        await stakingManagement.connect(deployer).setStakingLimits(STAKING_AMOUNT, STAKING_AMOUNT);
        await stakingToken.connect(staker1).approve(staking.target, STAKING_AMOUNT * 2);
        await stakingToken.connect(staker2).approve(staking.target, STAKING_AMOUNT * 2);
        const stake1EstimatedEarnings = await staking.connect(staker1).estimateStakeEarnings(STAKING_AMOUNT, planId);
        const stake2EstimatedEarnings = await staking.connect(staker2).estimateStakeEarnings(STAKING_AMOUNT, planId);
        const requiredStakingPoolBalance = (BigInt(STAKING_AMOUNT) * BigInt(2)) + BigInt(stake1EstimatedEarnings.predictedEarningsInTokens) + BigInt(stake2EstimatedEarnings.predictedEarningsInTokens);
        const stakingPoolAddress = await stakingPool.getAddress();
        await stakingToken.connect(deployer).transfer(stakingPoolAddress, requiredStakingPoolBalance);
        await stakingToken.connect(stakingPool).approve(staking.target, requiredStakingPoolBalance);
        await staking.connect(staker1).stake(STAKING_AMOUNT, planId);
        await staking.connect(staker2).stake(STAKING_AMOUNT, planId);

        await expect(stakingManagement.removeStakingPlan(planId))
            .to.be.revertedWithCustomError(stakingManagement, "StakingPlanHasActiveStakes");
      });

      it("Should not allow to remove a staking plan that does not exists", async function () {
        await expect(stakingManagement.removeStakingPlan(NON_EXISTING_PLAN_ID))
          .to.be.revertedWithCustomError(stakingManagement, "StakingPlanDoesNotExist");
      });

      it("Should not allow to remove a staking plan if not an owner", async function () {
        await expect(stakingManagement.connect(stranger).removeStakingPlan(planId))
          .to.be.revertedWithCustomError(stakingManagement, "CallerIsNotAStakingManager");
      });
    });

    describe("enableWithdraw", function () {
      it("Should enable withdraw", async function () {
        await stakingManagement.enableWithdraw();
        expect(await stakingManagement.isWithdrawEnabled()).to.be.true;
      });

      it("Should not allow to enable withdraw if not an owner", async function () {
        await expect(stakingManagement.connect(stranger).enableWithdraw())
          .to.be.revertedWithCustomError(stakingManagement, "CallerIsNotAStakingManager");
      });

      it("Should allow to withdraw if withdraw enabled", async function () {
        let planId: BigNumberish;
        let stakeId: BigNumberish;

        await stakingManagement.enableWithdraw();
        planId = await stakingManagement.addStakingPlan.staticCall(ONE_MONTH_IN_SECONDS, ONE_MONTH_APY);
        await stakingManagement.connect(deployer).addStakingPlan(ONE_MONTH_IN_SECONDS, ONE_MONTH_APY);

        await stakingManagement.connect(deployer).setStakingLimits(STAKING_AMOUNT, STAKING_AMOUNT);

        await stakingToken.connect(staker1).approve(staking.target, STAKING_AMOUNT);

        const stakeEstimatedEarnings = await staking.connect(staker1).estimateStakeEarnings(STAKING_AMOUNT, planId);
        const requiredStakingPoolBalance = BigInt(STAKING_AMOUNT) + BigInt(stakeEstimatedEarnings.predictedEarningsInTokens);
        const stakingPoolAddress = await stakingPool.getAddress();
        await stakingToken.connect(deployer).transfer(stakingPoolAddress, requiredStakingPoolBalance);
        await stakingToken.connect(stakingPool).approve(staking.target, requiredStakingPoolBalance);

        stakeId = await staking.connect(staker1).stake.staticCall(STAKING_AMOUNT, planId);
        await staking.connect(staker1).stake(STAKING_AMOUNT, planId);

        await ethers.provider.send("evm_increaseTime", [ONE_MONTH_IN_SECONDS / 2]);
        await ethers.provider.send("evm_mine");

        const balanceBefore = await stakingToken.balanceOf(await staker1.getAddress());

        await staking.connect(staker1).withdraw(stakeId);

        const balanceAfter = await stakingToken.balanceOf(await staker1.getAddress());

        expect(balanceAfter).to.be.gt(balanceBefore);
        expect(balanceAfter).to.be.eq(STAKER_BALANCE);
        expect(balanceBefore).to.be.eq(STAKER_BALANCE - STAKING_AMOUNT);

      });
    });

    describe("disableWithdraw", function () {
      it("Should disable withdraw", async function () {
        await stakingManagement.disableWithdraw();
        expect(await stakingManagement.isWithdrawEnabled()).to.be.false;
      });

      it("Should not allow to disable withdraw if not an owner", async function () {
        await expect(stakingManagement.connect(stranger).disableWithdraw())
          .to.be.revertedWithCustomError(stakingManagement, "CallerIsNotAStakingManager");
      });

      it("Should not allow to withdraw if withdraw disabled", async function () {
        let planId: BigNumberish;
        let stakeId: BigNumberish;

        await stakingManagement.disableWithdraw();
        planId = await stakingManagement.addStakingPlan.staticCall(ONE_MONTH_IN_SECONDS, ONE_MONTH_APY);
        await stakingManagement.connect(deployer).addStakingPlan(ONE_MONTH_IN_SECONDS, ONE_MONTH_APY);

        await stakingManagement.connect(deployer).setStakingLimits(STAKING_AMOUNT, STAKING_AMOUNT);

        await stakingToken.connect(staker1).approve(staking.target, STAKING_AMOUNT);

        const stakeEstimatedEarnings = await staking.connect(staker1).estimateStakeEarnings(STAKING_AMOUNT, planId);
        const requiredStakingPoolBalance = BigInt(STAKING_AMOUNT) + BigInt(stakeEstimatedEarnings.predictedEarningsInTokens);
        const stakingPoolAddress = await stakingPool.getAddress();
        await stakingToken.connect(deployer).transfer(stakingPoolAddress, requiredStakingPoolBalance);
        await stakingToken.connect(stakingPool).approve(staking.target, requiredStakingPoolBalance);

        stakeId = await staking.connect(staker1).stake.staticCall(STAKING_AMOUNT, planId);
        await staking.connect(staker1).stake(STAKING_AMOUNT, planId);

        await ethers.provider.send("evm_increaseTime", [ONE_MONTH_IN_SECONDS / 2]);
        await ethers.provider.send("evm_mine");

        expect(staking.connect(staker1).withdraw(stakeId)).to.be.revertedWithCustomError(staking, "EarlyWithdrawalNotAllowed");
      });
    });

    describe("setStakingLimits", function () {
      const MIN_STAKING_AMOUNT = BigInt(100);
      const MAX_STAKING_AMOUNT = BigInt(1000);

      it("Should set the staking limits", async function () {
        await stakingManagement.setStakingLimits(MIN_STAKING_AMOUNT, MAX_STAKING_AMOUNT);
        const result = await stakingManagement.getStakingLimits();

        expect(result[0]).to.equal(MIN_STAKING_AMOUNT);
        expect(result[1]).to.equal(MAX_STAKING_AMOUNT);
      });

      it("Should not allow to set the staking limits if not an owner", async function () {
        await expect(stakingManagement.connect(stranger).setStakingLimits(MIN_STAKING_AMOUNT, MAX_STAKING_AMOUNT))
          .to.be.revertedWithCustomError(stakingManagement, "CallerIsNotAStakingManager");
      });

      it("Should not allow to set the staking limits if min is greater than max", async function () {
        await expect(stakingManagement.setStakingLimits(MAX_STAKING_AMOUNT, MIN_STAKING_AMOUNT))
          .to.be.revertedWithCustomError(stakingManagement, "MinimumStakeMustBeLessThanOrEqualToMaximumStake");
      });
    });

    describe("setMinimumStake", function () {
      const MIN_STAKING_AMOUNT = 100;
      const MAX_STAKING_AMOUNT = 1000;

      beforeEach(async function () {
        await stakingManagement.setStakingLimits(MIN_STAKING_AMOUNT, MAX_STAKING_AMOUNT);
      });

      it("Should set the minimum staking amount", async function () {
        await stakingManagement.setMininumStake(MIN_STAKING_AMOUNT);
        expect(await stakingManagement.getMinimumStake()).to.equal(MIN_STAKING_AMOUNT);
      });

      it("Should not allow to set the minimum staking amount if not an owner", async function () {
        await expect(stakingManagement.connect(stranger).setMininumStake(MIN_STAKING_AMOUNT))
          .to.be.revertedWithCustomError(stakingManagement, "CallerIsNotAStakingManager");
      });

      it("Should not allow to set the minimum staking amount if greater than the maximum", async function () {
        await expect(stakingManagement.setMininumStake(MAX_STAKING_AMOUNT + 1 ))
          .to.be.revertedWithCustomError(stakingManagement, "MinimumStakeMustBeLessThanOrEqualToMaximumStake");
      });
    });

    describe("setMaximumStake", function () {
      const MIN_STAKING_AMOUNT = 100;
      const MAX_STAKING_AMOUNT = 1000;

      beforeEach(async function () {
        await stakingManagement.setStakingLimits(MIN_STAKING_AMOUNT, MAX_STAKING_AMOUNT);
      });

      it("Should set the maximum staking amount", async function () {
        await stakingManagement.setMaximumStake(MAX_STAKING_AMOUNT);
        expect(await stakingManagement.getMaximumStake()).to.equal(MAX_STAKING_AMOUNT);
      });

      it("Should not allow to set the maximum staking amount if not an owner", async function () {
        await expect(stakingManagement.connect(stranger).setMaximumStake(MAX_STAKING_AMOUNT))
          .to.be.revertedWithCustomError(stakingManagement, "CallerIsNotAStakingManager");
      });

      it("Should not allow to set the maximum staking amount if less than the minimum", async function () {
        await expect(stakingManagement.setMaximumStake(MIN_STAKING_AMOUNT - 1))
          .to.be.revertedWithCustomError(stakingManagement, "MinimumStakeMustBeLessThanOrEqualToMaximumStake");
      });
    });

    describe("checkStakingPlanExists", function () {
      let planId: BigNumberish;

      beforeEach(async function () {
        planId = await stakingManagement.addStakingPlan.staticCall(ONE_MONTH_IN_SECONDS, ONE_MONTH_APY);
        await stakingManagement.connect(deployer).addStakingPlan(ONE_MONTH_IN_SECONDS, ONE_MONTH_APY);
      });

      it("Should return true if the staking plan exists", async function () {
        expect(await stakingManagement.checkStakingPlanExists(planId)).not.to.be.reverted;
      });

      it("Should revert if the staking plan does not exists", async function () {
        await expect(stakingManagement.checkStakingPlanExists(999)).to.be.revertedWithCustomError(stakingManagement, "StakingPlanDoesNotExist");
      })
    });

    describe("setStaking", function () {
      it("Should set the staking contract", async function () {
        await stakingManagement.setStaking(staking.target);
        expect(await stakingManagement.getStaking()).to.equal(staking.target);
      });

      it("Should not allow to set the staking contract if not a STAKING_MANAGER", async function () {
        await expect(stakingManagement.connect(stranger).setStaking(staking.target))
          .to.be.revertedWithCustomError(stakingManagement, "CallerIsNotAStakingManager");
      });
    });

    describe("getStakingToken", function () {
      it("Should return the staking token address", async function () {
        expect(await stakingManagement.getStakingToken()).to.equal(stakingToken.target);
      });
    });

    describe("getStakingPlan", function () {
      let planId: BigNumberish;

      beforeEach(async function () {
        planId = await stakingManagement.addStakingPlan.staticCall(ONE_MONTH_IN_SECONDS, ONE_MONTH_APY);
        await stakingManagement.connect(deployer).addStakingPlan(ONE_MONTH_IN_SECONDS, ONE_MONTH_APY);
      });

      it("Should return the staking plan", async function () {
        const result = await stakingManagement.getStakingPlan(planId);
        expect(result[0]).to.equal(ONE_MONTH_IN_SECONDS);
        expect(result[1]).to.equal(ONE_MONTH_APY);
      });
    });

    describe("getStakingPlans", function () {
      let firstPlanId: BigNumberish;
      let secondPlanId: BigNumberish;
      let thirdPlanId: BigNumberish;
      let fourthPlanId: BigNumberish;

      const OFFSET = 0;

      beforeEach(async function () {
        firstPlanId = await stakingManagement.addStakingPlan.staticCall(ONE_MONTH_IN_SECONDS, ONE_MONTH_APY);
        await stakingManagement.connect(deployer).addStakingPlan(ONE_MONTH_IN_SECONDS, ONE_MONTH_APY);
        secondPlanId = await stakingManagement.addStakingPlan.staticCall(THREE_MONTHS_IN_SECONDS, THREE_MONTHS_APY);
        await stakingManagement.connect(deployer).addStakingPlan(THREE_MONTHS_IN_SECONDS, THREE_MONTHS_APY);
        thirdPlanId = await stakingManagement.addStakingPlan.staticCall(SIX_MONTHS_IN_SECONDS, SIX_MONTHS_APY);
        await stakingManagement.connect(deployer).addStakingPlan(SIX_MONTHS_IN_SECONDS, SIX_MONTHS_APY);
        fourthPlanId = await stakingManagement.addStakingPlan.staticCall(TWELVE_MONTHS_IN_SECONDS, TWELVE_MONTHS_APY);
        await stakingManagement.connect(deployer).addStakingPlan(TWELVE_MONTHS_IN_SECONDS, TWELVE_MONTHS_APY);
      });

      it("Should return the staking plans", async function () {
        const result = await stakingManagement.getStakingPlans(OFFSET, 4);
        expect(result[0][0]).to.equal(ONE_MONTH_IN_SECONDS);
        expect(result[0][1]).to.equal(ONE_MONTH_APY);
        expect(result[1][0]).to.equal(THREE_MONTHS_IN_SECONDS);
        expect(result[1][1]).to.equal(THREE_MONTHS_APY);
        expect(result[2][0]).to.equal(SIX_MONTHS_IN_SECONDS);
        expect(result[2][1]).to.equal(SIX_MONTHS_APY);
        expect(result[3][0]).to.equal(TWELVE_MONTHS_IN_SECONDS);
        expect(result[3][1]).to.equal(TWELVE_MONTHS_APY);
      });
    });

    describe("getStakingPlansAmount", function() {
      it("Should return the amount of staking plans if 1 plan exists", async function () {
        await stakingManagement.addStakingPlan(ONE_MONTH_IN_SECONDS, ONE_MONTH_APY);
        expect(await stakingManagement.getStakingPlansAmount()).to.equal(1);
      });

      it("Should return the amount of staking plans if many plan exists", async function () {
        await stakingManagement.addStakingPlan(ONE_MONTH_IN_SECONDS, ONE_MONTH_APY);
        await stakingManagement.addStakingPlan(THREE_MONTHS_IN_SECONDS, THREE_MONTHS_APY);
        await stakingManagement.addStakingPlan(SIX_MONTHS_IN_SECONDS, SIX_MONTHS_APY);
        await stakingManagement.addStakingPlan(TWELVE_MONTHS_IN_SECONDS, TWELVE_MONTHS_APY);
        expect(await stakingManagement.getStakingPlansAmount()).to.equal(4);
      });
    });

    describe("isWithdrawalEnabled", function () {
      it("Should return true if withdrawal is enabled", async function () {
        await stakingManagement.enableWithdraw();
        expect(await stakingManagement.isWithdrawEnabled()).to.be.true;
      });

      it("Should return false if withdrawal is disabled", async function () {
        await stakingManagement.disableWithdraw();
        expect(await stakingManagement.isWithdrawEnabled()).to.be.false;
      });
    });

    describe("getStakingLimits", function () {
      const MIN_STAKING_AMOUNT = BigInt(100);
      const MAX_STAKING_AMOUNT = BigInt(1000);

      beforeEach(async function () {
        await stakingManagement.setStakingLimits(MIN_STAKING_AMOUNT, MAX_STAKING_AMOUNT);
      });

      it("Should return the staking limits", async function () {
        const result = await stakingManagement.getStakingLimits();
        expect(result[0]).to.equal(MIN_STAKING_AMOUNT);
        expect(result[1]).to.equal(MAX_STAKING_AMOUNT);
      });
    });

    describe("getMinimumStake", function () {
      const MIN_STAKING_AMOUNT = BigInt(100);
      const MAX_STAKING_AMOUNT = BigInt(1000);

      beforeEach(async function () {
        await stakingManagement.setStakingLimits(MIN_STAKING_AMOUNT, MAX_STAKING_AMOUNT);
      });

      it("Should return the minimum staking amount", async function () {
        expect(await stakingManagement.getMinimumStake()).to.equal(MIN_STAKING_AMOUNT);
      });
    });

    describe("getMaximumStake", function () {
      const MIN_STAKING_AMOUNT = BigInt(100);
      const MAX_STAKING_AMOUNT = BigInt(1000);

      beforeEach(async function () {
        await stakingManagement.setStakingLimits(MIN_STAKING_AMOUNT, MAX_STAKING_AMOUNT);
      });

      it("Should return the maximum staking amount", async function () {
        expect(await stakingManagement.getMaximumStake()).to.equal(MAX_STAKING_AMOUNT);
      });
    });

    describe("getStaking", function () {
      it("Should return the staking contract address", async function () {
        expect(await stakingManagement.getStaking()).to.equal(staking.target);
      });
    });
  })
})