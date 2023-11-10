import { expect } from "chai";
import { ethers, run } from "hardhat";
import { BigNumberish, Signer } from "ethers";
import { StakingManagement, IQTMock } from "../typechain";

describe("StakingManagement Contract", function () {
  let deployer: Signer;
  let stranger: Signer;
  let stakingToken: IQTMock;
  let stakingManagement: StakingManagement;

  const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

  beforeEach(async function () {
    const accounts = await ethers.getSigners();

    deployer = accounts[0];
    stranger = accounts[1];

    const deployerAddress = await deployer.getAddress();

    stakingToken = (await run("deploy:iqt-mock", { mintTo: deployerAddress })) as IQTMock;

    stakingManagement = (await run("deploy:staking-management", {
      stakingToken: stakingToken.target,
    })) as StakingManagement;
  });

  describe("Deployment", function () {
    it("Should deploy the StakingManagement contract", async function () {
      expect(stakingManagement.target).to.not.equal(ZERO_ADDRESS);
    });

    it("Should set the staking token address", async function () {
      expect(await stakingManagement.getStakingToken()).to.equal(stakingToken.target);
    });

    it("Should set the owner address", async function () {
      expect(await stakingManagement.owner()).to.equal(await deployer.getAddress());
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
      it("Should add a staking plan", async function () {
        await stakingManagement.addStakingPlan(ONE_MONTH_IN_SECONDS, ONE_MONTH_APY);
        expect(await stakingManagement.getStakingPlansAmount()).to.equal(1);
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

      it("Should not allow to add a staking plan if not an owner", async function () {
        await expect(stakingManagement.connect(stranger).addStakingPlan(ONE_MONTH_IN_SECONDS, ONE_MONTH_APY))
          .to.be.revertedWith("Ownable: caller is not the owner");
      });
    });

    describe("updateStakingPlan", function () {
      const NON_EXISTING_PLAN_ID = 999;
      let planId: BigNumberish;

      beforeEach(async function () {
        planId = await stakingManagement.addStakingPlan.staticCall(ONE_MONTH_IN_SECONDS, ONE_MONTH_APY);
        await stakingManagement.addStakingPlan(ONE_MONTH_IN_SECONDS, ONE_MONTH_APY);
      });

      it("Should update a staking plan", async function () {
        await stakingManagement.updateStakingPlan(planId, THREE_MONTHS_IN_SECONDS, THREE_MONTHS_APY);
        expect(await stakingManagement.getStakingPlansAmount()).to.equal(1);
      });

      it("Should not allow to update a staking plan that does not exists", async function () {
        await expect(stakingManagement.updateStakingPlan(NON_EXISTING_PLAN_ID, ZERO_SECONDS, ONE_MONTH_APY))
          .to.be.revertedWithCustomError(stakingManagement, "StakingPlanDoesNotExist");
      });

      it("Should not allow to update a staking plan with the 0 duration", async function () {
        await expect(stakingManagement.updateStakingPlan(planId, ZERO_SECONDS, ONE_MONTH_APY))
          .to.be.revertedWithCustomError(stakingManagement, "DurationMustBeGreaterThanZero");
      });

      it("Should not allow to update a staking plan with the 0% APY", async function () {
        await expect(stakingManagement.updateStakingPlan(planId, ONE_MONTH_IN_SECONDS, ZERO_PERCENT))
          .to.be.revertedWithCustomError(stakingManagement, "APYMustBeWithinRange");
      });

      it("Should not allow to update a staking plan with more the 100% APY", async function () {
        await expect(stakingManagement.updateStakingPlan(planId, ONE_MONTH_IN_SECONDS, HUNDED_ONE_PERCENT))
          .to.be.revertedWithCustomError(stakingManagement, "APYMustBeWithinRange");
      });

      it("Should not allow to update a staking plan if not an owner", async function () {
        await expect(stakingManagement.connect(stranger).updateStakingPlan(planId, ONE_MONTH_IN_SECONDS, ONE_MONTH_APY))
          .to.be.revertedWith("Ownable: caller is not the owner");
      });
    });

    describe("removeStakingPlan", function () {
      const NON_EXISTING_PLAN_ID = 999;
      let planId: BigNumberish;

      beforeEach(async function () {
        planId = await stakingManagement.addStakingPlan.staticCall(ONE_MONTH_IN_SECONDS, ONE_MONTH_APY);
        await stakingManagement.connect(deployer).addStakingPlan(ONE_MONTH_IN_SECONDS, ONE_MONTH_APY);
      });

      it("Should remove a staking plan", async function () {
        await stakingManagement.connect(deployer).removeStakingPlan(planId);
        expect(await stakingManagement.getStakingPlansAmount()).to.equal(0);
      });

      it("Should not allow to remove a staking plan that does not exists", async function () {
        await expect(stakingManagement.removeStakingPlan(NON_EXISTING_PLAN_ID))
          .to.be.revertedWithCustomError(stakingManagement, "StakingPlanDoesNotExist");
      });

      it("Should not allow to remove a staking plan if not an owner", async function () {
        await expect(stakingManagement.connect(stranger).removeStakingPlan(planId))
          .to.be.revertedWith("Ownable: caller is not the owner");
      });
    });

    describe("enableWithdraw", function () {
      it("Should enable withdraw", async function () {
        await stakingManagement.enableWithdraw();
        expect(await stakingManagement.isWithdrawEnabled()).to.be.true;
      });

      it("Should not allow to enable withdraw if not an owner", async function () {
        await expect(stakingManagement.connect(stranger).enableWithdraw())
          .to.be.revertedWith("Ownable: caller is not the owner");
      });
    });

    describe("disableWithdraw", function () {
      it("Should disable withdraw", async function () {
        await stakingManagement.disableWithdraw();
        expect(await stakingManagement.isWithdrawEnabled()).to.be.false;
      });

      it("Should not allow to disable withdraw if not an owner", async function () {
        await expect(stakingManagement.connect(stranger).disableWithdraw())
          .to.be.revertedWith("Ownable: caller is not the owner");
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
          .to.be.revertedWith("Ownable: caller is not the owner");
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
          .to.be.revertedWith("Ownable: caller is not the owner");
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
          .to.be.revertedWith("Ownable: caller is not the owner");
      });

      it("Should not allow to set the maximum staking amount if less than the minimum", async function () {
        await expect(stakingManagement.setMaximumStake(MIN_STAKING_AMOUNT - 1))
          .to.be.revertedWithCustomError(stakingManagement, "MinimumStakeMustBeLessThanOrEqualToMaximumStake");
      });
    });
  })
})