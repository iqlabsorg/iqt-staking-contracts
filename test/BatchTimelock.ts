import { expect } from "chai";
import { ethers, run } from "hardhat";
import { BigNumberish, Signer, id } from "ethers";
import { BatchTimelock, IQTMock } from "../typechain";

export const solidityIdBytes32 = (string: string): string => {
  return id(string);
};

describe("BatchTimelock Contract", function () {
  let deployer: Signer;
  let vestingPool: Signer;
  let stranger: Signer;
  let timelockReceiver1: Signer;
  let timelockReceiver2: Signer;
  let timelockReceiver3: Signer;
  let timelockReceiver4: Signer;
  let iqtMock: IQTMock;
  let batchTimelock: BatchTimelock;

  const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
  const TERMINATION_ADMIN_ROLE = solidityIdBytes32("TERMINATION_ADMIN");
  const TIMELOCK_CREATOR_ROLE = solidityIdBytes32("TIMELOCK_CREATOR");

  beforeEach(async function () {
    const accounts = await ethers.getSigners();
    deployer = accounts[0];
    vestingPool = accounts[1];
    stranger = accounts[2];
    timelockReceiver1 = accounts[3];
    timelockReceiver2 = accounts[4];
    timelockReceiver3 = accounts[5];
    timelockReceiver4 = accounts[6];

    const deployerAddress = await deployer.getAddress();
    const vestingPoolAddress = await vestingPool.getAddress();

    iqtMock = (await run("deploy:iqt-mock", { mintTo: deployerAddress })) as IQTMock;

    await iqtMock.connect(deployer).transfer(vestingPoolAddress, ethers.parseEther('10'));

    batchTimelock = (await run("deploy:batch-timelock", { token: iqtMock.target, vestingPool: vestingPoolAddress })) as BatchTimelock;

    await iqtMock.connect(vestingPool).approve(batchTimelock.target, ethers.parseEther('10'));
  });

  describe("Deployment", function () {
    it("Should set the right token address", async function () {
      expect(await batchTimelock.getTokenAddress()).to.equal(iqtMock.target);
    });

    it("Should set the roles for deployer", async function () {
      const deployerAddress = await deployer.getAddress();
      const defaultAdminRole = await batchTimelock.DEFAULT_ADMIN_ROLE();
      expect(await batchTimelock.hasRole(defaultAdminRole, deployerAddress)).to.equal(true);
      expect(await batchTimelock.hasRole(TERMINATION_ADMIN_ROLE, deployerAddress)).to.equal(true);
      expect(await batchTimelock.hasRole(TIMELOCK_CREATOR_ROLE, deployerAddress)).to.equal(true);
    });
  });

  describe("Functionality", function () {
    const CLIFF_DURATION = 15_780_000; // 6 months in seconds
    const VESTING_DURATION = 31_536_000; // 1 year in seconds
    const TIMELOCK_AMOUNT: BigNumberish = ethers.parseEther('1');
    const TIMESTAMP_NOW = Math.floor(Date.now() / 1000);

    let timelockReceiver1Address: string;
    let timelockReceiver2Address: string;
    let timelockReceiver3Address: string;
    let timelockReceiver4Address: string;

    describe("addTimelock", function () {
      beforeEach(async function () {
        timelockReceiver1Address = await timelockReceiver1.getAddress();
        timelockReceiver2Address = await timelockReceiver2.getAddress();
        await batchTimelock.connect(deployer).addTimelock(timelockReceiver1Address, TIMELOCK_AMOUNT, TIMESTAMP_NOW, CLIFF_DURATION, VESTING_DURATION);
      });

      it("Should correctly add a timelock", async function () {
        it("Should correctly emit a TimelockCreated event", async function () {
          await expect(batchTimelock.connect(deployer).addTimelock(timeLockReceiver2Address, TIMELOCK_AMOUNT, TIMESTAMP_NOW, CLIFF_DURATION, VESTING_DURATION))
          .to.emit(batchTimelock, 'TimelockCreated')
          .withArgs(timeLockReceiver2Address, TIMELOCK_AMOUNT, TIMESTAMP_NOW, CLIFF_DURATION, VESTING_DURATION);
        const timelock2 = await batchTimelock.getTimelock(timeLockReceiver2Address);
        expect(timelock2.totalAmount).to.equal(TIMELOCK_AMOUNT);
        });

        it("Should correctly create a timelock", async function () {
          const timelock = await batchTimelock.getTimelock(timelockReceiver1Address);
          expect(timelock.receiver).to.equal(timelockReceiver1Address);
          expect(timelock.totalAmount).to.equal(TIMELOCK_AMOUNT);
          expect(timelock.cliffDuration).to.equal(CLIFF_DURATION);
          expect(timelock.vestingDuration).to.equal(VESTING_DURATION);
          expect(timelock.terminationFrom).to.equal(0);
          expect(timelock.isTerminated).to.equal(false);
        });
      });

      it('should fail to add a timelock if the caller is not a timelock creator', async function () {
        await expect(batchTimelock.connect(stranger).addTimelock(timelockReceiver2Address, TIMELOCK_AMOUNT, TIMESTAMP_NOW, CLIFF_DURATION, VESTING_DURATION))
          .to.be.revertedWithCustomError(batchTimelock, `CallerIsNotATimelockCreator`);
      });

      it("Should fail to add a timelock for a zero address", async function () {
        await expect(batchTimelock.connect(deployer).addTimelock(ZERO_ADDRESS, TIMELOCK_AMOUNT, TIMESTAMP_NOW, CLIFF_DURATION, VESTING_DURATION))
          .to.be.revertedWithCustomError(batchTimelock, `InvalidReceiverAddress`);
      });

      it("Should fail to add a timelock if total amount is 0", async function () {
        await expect(batchTimelock.connect(deployer).addTimelock(timelockReceiver1Address, 0, TIMESTAMP_NOW, CLIFF_DURATION, VESTING_DURATION))
          .to.be.revertedWithCustomError(batchTimelock, `InvalidTimelockAmount`);
      });

      it("Should fail to add a timelock for an existing receiver", async function () {
        await expect(batchTimelock.connect(deployer).addTimelock(timelockReceiver1Address, TIMELOCK_AMOUNT, TIMESTAMP_NOW, CLIFF_DURATION, VESTING_DURATION))
          .to.be.revertedWithCustomError(batchTimelock, `ReceiverAlreadyHasATimelock`);
      });
    });

    describe("addTimelockBatch", function () {
      let timelockReceiver1Address: string;
      let timelockReceiver2Address: string;
      let timelockReceiver3Address: string;
      let batchOfReceivers: any[];

      beforeEach(async function () {
        timelockReceiver1Address = await timelockReceiver1.getAddress();
        timelockReceiver2Address = await timelockReceiver2.getAddress();
        timelockReceiver3Address = await timelockReceiver3.getAddress();
        batchOfReceivers = [
          { receiver: timelockReceiver1Address, totalAmount: TIMELOCK_AMOUNT, timelockFrom: TIMESTAMP_NOW, cliffDuration: CLIFF_DURATION, vestingDuration: VESTING_DURATION },
          { receiver: timelockReceiver2Address, totalAmount: TIMELOCK_AMOUNT, timelockFrom: TIMESTAMP_NOW, cliffDuration: CLIFF_DURATION, vestingDuration: VESTING_DURATION },
          { receiver: timelockReceiver3Address, totalAmount: TIMELOCK_AMOUNT, timelockFrom: TIMESTAMP_NOW, cliffDuration: CLIFF_DURATION, vestingDuration: VESTING_DURATION },
        ];
      });

      it("Should correctly add a batch of timelocks", async function () {
        const batch = await batchTimelock.addTimelockBatch(batchOfReceivers);
        await batch.wait();
        const filter = batchTimelock.filters.TimelockCreated();
        const logs = await batchTimelock.queryFilter(filter);
        expect(logs.length).to.equal(3);

        // Logs[0]
        expect(logs[0].args.receiver).to.equal(timelockReceiver1Address);
        expect(logs[0].args.totalAmount).to.equal(TIMELOCK_AMOUNT);
        expect(logs[0].args.timelockFrom).to.equal(TIMESTAMP_NOW);
        expect(logs[0].args.cliffDuration).to.equal(CLIFF_DURATION);
        expect(logs[0].args.vestingDuration).to.equal(VESTING_DURATION);
        // Logs[1]
        expect(logs[1].args.receiver).to.equal(timelockReceiver2Address);
        expect(logs[1].args.totalAmount).to.equal(TIMELOCK_AMOUNT);
        expect(logs[1].args.timelockFrom).to.equal(TIMESTAMP_NOW);
        expect(logs[1].args.cliffDuration).to.equal(CLIFF_DURATION);
        expect(logs[1].args.vestingDuration).to.equal(VESTING_DURATION);
        // Logs[2]
        expect(logs[2].args.receiver).to.equal(timelockReceiver3Address);
        expect(logs[2].args.totalAmount).to.equal(TIMELOCK_AMOUNT);
        expect(logs[2].args.timelockFrom).to.equal(TIMESTAMP_NOW);
        expect(logs[2].args.cliffDuration).to.equal(CLIFF_DURATION);
        expect(logs[2].args.vestingDuration).to.equal(VESTING_DURATION);
      });

      it("Should fail to add a batch if the caller is not a timelock creator", async function () {
        await expect(batchTimelock.connect(stranger).addTimelockBatch(batchOfReceivers))
          .to.be.revertedWithCustomError(batchTimelock, `CallerIsNotATimelockCreator`);
      });

      it("Should fail to add a batch with a zero address", async function () {
        batchOfReceivers[0].receiver = ZERO_ADDRESS;
        await expect(batchTimelock.connect(deployer).addTimelockBatch(batchOfReceivers))
          .to.be.revertedWithCustomError(batchTimelock, `InvalidReceiverAddress`);
      });

      it("Should fail to add a batch if total amount is 0 for any receiver", async function () {
        batchOfReceivers[0].totalAmount = 0;
        await expect(batchTimelock.connect(deployer).addTimelockBatch(batchOfReceivers))
          .to.be.revertedWithCustomError(batchTimelock, `InvalidTimelockAmount`);
      });

      it("Should fail to add a batch for an existing receiver", async function () {
        await batchTimelock.connect(deployer).addTimelock(timelockReceiver1Address, TIMELOCK_AMOUNT, TIMESTAMP_NOW, CLIFF_DURATION, VESTING_DURATION);
        await expect(batchTimelock.connect(deployer).addTimelockBatch(batchOfReceivers))
          .to.be.revertedWithCustomError(batchTimelock, `ReceiverAlreadyHasATimelock`);
      });

      it("Should fail to add a batch if the batch is empty", async function () {
        await expect(batchTimelock.connect(deployer).addTimelockBatch([]))
          .to.be.revertedWithCustomError(batchTimelock, `EmptyReceiversArray`);
      });
    });

    describe("claim function", function () {
      let timelockReceiverAddress: string;
      let initialVestingAmount: bigint;
      let halfVestingAmount: bigint;
      let cliffDuration: number;
      let vestingDuration: number;
      let timelockFrom: number;
      let timelockReceiver1: Signer;

      beforeEach(async function () {
        [deployer, timelockReceiver1] = await ethers.getSigners();
        timelockReceiverAddress = await timelockReceiver1.getAddress();

        initialVestingAmount = ethers.parseEther("1"); // 1 token for simplicity
        halfVestingAmount = initialVestingAmount / BigInt(2);
        cliffDuration = 6 * 30 * 24 * 60 * 60; // 6 months in seconds
        vestingDuration = 12 * 30 * 24 * 60 * 60; // 12 months in seconds
        const latestBlock =  await ethers.provider.getBlock("latest");
        const latestBlockTimestamp = latestBlock!.timestamp;
        timelockFrom = latestBlockTimestamp;

        await batchTimelock.connect(deployer).addTimelock(
          timelockReceiverAddress,
          initialVestingAmount,
          latestBlockTimestamp,
          cliffDuration,
          vestingDuration
        );
      });

      it("Should fail to claim when amount is zero", async function () {
        await expect(batchTimelock.connect(timelockReceiver1).claim(0))
          .to.be.revertedWithCustomError(batchTimelock, "ZeroClaimAmount");
      });

      it("Should fail to claim before the cliff period ends", async function () {
        await expect(batchTimelock.connect(timelockReceiver1).claim(ethers.parseEther("0.1")))
          .to.be.revertedWithCustomError(batchTimelock, "CliffPeriodNotEnded");
      });

      it("Should fail to claim more than the withdrawable amount", async function () {
        // Fast-forward time to after the cliff period
        await ethers.provider.send("evm_increaseTime", [cliffDuration + 1]);
        await ethers.provider.send("evm_mine", []);

        const amountToClaim = ethers.parseEther("2"); // More than initialVestingAmount
        await expect(batchTimelock.connect(timelockReceiver1).claim(amountToClaim))
          .to.be.revertedWithCustomError(batchTimelock, "AmountExceedsWithdrawableAllowance");
      });

      it("Should allow to claim only half of the amount if terminated on the half of the vesting", async function () {
        // Terminate the timelock and then fast-forward past the termination date
        await batchTimelock.connect(deployer).terminate(timelockReceiverAddress, timelockFrom + cliffDuration + (vestingDuration / 2));
        await ethers.provider.send("evm_increaseTime", [cliffDuration + (vestingDuration / 2)]);
        await ethers.provider.send("evm_mine", []);

        const withdrawable = await batchTimelock.getClaimableBalance(timelockReceiverAddress);

        await expect(batchTimelock.connect(timelockReceiver1).claim(halfVestingAmount))
          .to.emit(batchTimelock, "TokensClaimed")
          .withArgs(timelockReceiverAddress, halfVestingAmount);
        expect(withdrawable).to.be.eq(halfVestingAmount);
      });

      it("Should successfully claim the exact withdrawable amount after the cliff period", async function () {
        await ethers.provider.send("evm_increaseTime", [cliffDuration + 1]);
        await ethers.provider.send("evm_mine", []);

        const withdrawable = await batchTimelock.getClaimableBalance(timelockReceiverAddress);
        await expect(batchTimelock.connect(timelockReceiver1).claim(withdrawable))
          .to.emit(batchTimelock, "TokensClaimed")
          .withArgs(timelockReceiverAddress, withdrawable);
      });

      it("Should successfully claim within the allowable limit", async function () {
        // Fast-forward time to after the cliff period
        await ethers.provider.send("evm_increaseTime", [cliffDuration + (vestingDuration / 2)]);
        await ethers.provider.send("evm_mine", []);

        const claimableAmount = await batchTimelock.getClaimableBalance(timelockReceiverAddress);

        await expect(batchTimelock.connect(timelockReceiver1).claim(claimableAmount))
          .to.emit(batchTimelock, "TokensClaimed")
          .withArgs(timelockReceiverAddress, claimableAmount);
      });

      it("Should successfully claim the whole amount after the vesting period", async function () {
        // Fast-forward time to after the cliff period
        await ethers.provider.send("evm_increaseTime", [cliffDuration + vestingDuration + 1]);
        await ethers.provider.send("evm_mine", []);

        const claimableAmount = await batchTimelock.getClaimableBalance(timelockReceiverAddress);

        await expect(batchTimelock.connect(timelockReceiver1).claim(claimableAmount))
          .to.emit(batchTimelock, "TokensClaimed")
          .withArgs(timelockReceiverAddress, initialVestingAmount);
      });

      it("Should fail if the token transfer fails", async function () {
        await iqtMock.connect(vestingPool).approve(batchTimelock.target, 0);
        await ethers.provider.send("evm_increaseTime", [cliffDuration + vestingDuration + 1]);
        await ethers.provider.send("evm_mine", []);
        await expect(batchTimelock.connect(timelockReceiver1).claim(initialVestingAmount))
          .to.be.revertedWith("ERC20: insufficient allowance");
      });
    });

    describe("getClaimableBalance function", function () {
      let timelockReceiver1Address: string;
      let initialVestingAmount: bigint;
      let cliffDuration: number;
      let vestingDuration: number;
      let timelockFrom: number;

      beforeEach(async function () {
        timelockReceiver1Address = await timelockReceiver1.getAddress();
        initialVestingAmount = ethers.parseEther("1"); // 1 token
        cliffDuration = 6 * 30 * 24 * 60 * 60; // 6 months in seconds
        vestingDuration = 12 * 30 * 24 * 60 * 60; // 12 months in seconds
        const block = await ethers.provider.getBlock("latest");
        timelockFrom = block!.timestamp;

        await batchTimelock.connect(deployer).addTimelock(
          timelockReceiver1Address,
          initialVestingAmount,
          timelockFrom,
          cliffDuration,
          vestingDuration
        );
      });

      it("Should return 0 before the cliff period ends", async function () {
        const balance = await batchTimelock.getClaimableBalance(timelockReceiver1Address);
        expect(balance).to.equal(0);
      });

      it("Should increase the claimable balance over time after the cliff period", async function () {
        const halfVestingTime = cliffDuration + vestingDuration / 2;
        await ethers.provider.send("evm_increaseTime", [halfVestingTime]);
        await ethers.provider.send("evm_mine", []);

        const balance = await batchTimelock.getClaimableBalance(timelockReceiver1Address);
        const expectedBalance = initialVestingAmount / BigInt(2);
        expect(balance).to.be.closeTo(expectedBalance, ethers.parseEther("0.1"));
      });

      it("Should return the total vested amount after the vesting period ends", async function () {
        await ethers.provider.send("evm_increaseTime", [cliffDuration + vestingDuration]);
        await ethers.provider.send("evm_mine", []);

        const balance = await batchTimelock.getClaimableBalance(timelockReceiver1Address);
        expect(balance).to.equal(initialVestingAmount);
      });

      it("Should return 0 if terminated before the cliff period ends", async function () {
        const terminationTime = timelockFrom + cliffDuration / 2;
        await batchTimelock.connect(deployer).terminate(timelockReceiver1Address, terminationTime);

        await ethers.provider.send("evm_increaseTime", [terminationTime]);
        await ethers.provider.send("evm_mine", []);

        const balance = await batchTimelock.getClaimableBalance(timelockReceiver1Address);
        expect(balance).to.equal(0);
      });

      it("Should reflect the vested amount until the termination time if terminated during vesting", async function () {
        const terminationTime = timelockFrom + cliffDuration + vestingDuration / 2;
        await batchTimelock.connect(deployer).terminate(timelockReceiver1Address, terminationTime);

        await ethers.provider.send("evm_increaseTime", [terminationTime]);
        await ethers.provider.send("evm_mine", []);

        const balance = await batchTimelock.getClaimableBalance(timelockReceiver1Address);
        const expectedBalance = initialVestingAmount / BigInt(2);
        expect(balance).to.be.closeTo(expectedBalance, ethers.parseEther("0.1"));
      });
    });

    describe("getTimelock function", function () {
      beforeEach(async function () {
        timelockReceiver1Address = await timelockReceiver1.getAddress();
        await batchTimelock.connect(deployer).addTimelock(timelockReceiver1Address, TIMELOCK_AMOUNT, TIMESTAMP_NOW, CLIFF_DURATION, VESTING_DURATION);
      });

      it("Should return the correct timelock", async function () {
        const timelock = await batchTimelock.getTimelock(timelockReceiver1Address);
        expect(timelock.receiver).to.equal(timelockReceiver1Address);
        expect(timelock.totalAmount).to.equal(TIMELOCK_AMOUNT);
        expect(timelock.cliffDuration).to.equal(CLIFF_DURATION);
        expect(timelock.vestingDuration).to.equal(VESTING_DURATION);
        expect(timelock.terminationFrom).to.equal(0);
        expect(timelock.isTerminated).to.equal(false);
      });
    });

    describe("getTimelockReceivers", function () {
      const OFFSET = 0;

      beforeEach(async function() {
        timelockReceiver1Address = await timelockReceiver1.getAddress();
        timelockReceiver2Address = await timelockReceiver2.getAddress();
        timelockReceiver3Address = await timelockReceiver3.getAddress();
        timelockReceiver4Address = await timelockReceiver4.getAddress();
        await batchTimelock.connect(deployer).addTimelock(timelockReceiver1Address, TIMELOCK_AMOUNT, TIMESTAMP_NOW, CLIFF_DURATION, VESTING_DURATION);
        await batchTimelock.connect(deployer).addTimelock(timelockReceiver2Address, TIMELOCK_AMOUNT, TIMESTAMP_NOW, CLIFF_DURATION, VESTING_DURATION);
        await batchTimelock.connect(deployer).addTimelock(timelockReceiver3Address, TIMELOCK_AMOUNT, TIMESTAMP_NOW, CLIFF_DURATION, VESTING_DURATION);
        await batchTimelock.connect(deployer).addTimelock(timelockReceiver4Address, TIMELOCK_AMOUNT, TIMESTAMP_NOW, CLIFF_DURATION, VESTING_DURATION);
      });

      it('Should return the correct timelock receivers', async function () {
        const timelockReceivers = await batchTimelock.getTimelockReceivers(OFFSET, 4);
        expect(timelockReceivers.length).to.equal(4);
        expect(timelockReceivers[0]).to.equal(timelockReceiver1Address);
        expect(timelockReceivers[1]).to.equal(timelockReceiver2Address);
        expect(timelockReceivers[2]).to.equal(timelockReceiver3Address);
        expect(timelockReceivers[3]).to.equal(timelockReceiver4Address);
      });

      it('Should return the correct timelock receivers with offset', async function () {
        const timelockReceivers = await batchTimelock.getTimelockReceivers(2, 2);
        expect(timelockReceivers.length).to.equal(2);
        expect(timelockReceivers[0]).to.equal(timelockReceiver3Address);
        expect(timelockReceivers[1]).to.equal(timelockReceiver4Address);
      });

      it('Should return the correct timelock receivers with offset and limit', async function () {
        const timelockReceivers = await batchTimelock.getTimelockReceivers(1, 2);
        expect(timelockReceivers.length).to.equal(2);
        expect(timelockReceivers[0]).to.equal(timelockReceiver2Address);
        expect(timelockReceivers[1]).to.equal(timelockReceiver3Address);
      });
    });

    describe("getTimelockReceiversAmount", function () {
      it('Should return the correct timelock receivers amount', async function () {
        timelockReceiver1Address = await timelockReceiver1.getAddress();
        timelockReceiver2Address = await timelockReceiver2.getAddress();
        timelockReceiver3Address = await timelockReceiver3.getAddress();
        timelockReceiver4Address = await timelockReceiver4.getAddress();
        await batchTimelock.connect(deployer).addTimelock(timelockReceiver1Address, TIMELOCK_AMOUNT, TIMESTAMP_NOW, CLIFF_DURATION, VESTING_DURATION);
        await batchTimelock.connect(deployer).addTimelock(timelockReceiver2Address, TIMELOCK_AMOUNT, TIMESTAMP_NOW, CLIFF_DURATION, VESTING_DURATION);
        await batchTimelock.connect(deployer).addTimelock(timelockReceiver3Address, TIMELOCK_AMOUNT, TIMESTAMP_NOW, CLIFF_DURATION, VESTING_DURATION);
        await batchTimelock.connect(deployer).addTimelock(timelockReceiver4Address, TIMELOCK_AMOUNT, TIMESTAMP_NOW, CLIFF_DURATION, VESTING_DURATION);
        const timelockReceiversAmount = await batchTimelock.getTimelockReceiversAmount();
        expect(timelockReceiversAmount).to.equal(4);
      });

      it('Should return 0 if no receivers', async function () {
        const timelockReceiversAmount = await batchTimelock.getTimelockReceiversAmount();
        expect(timelockReceiversAmount).to.equal(0);
      });
    });

    describe("getCurrentAllowance", function () {
      it('Should return the correct allowance', async function () {
        const allowance = await batchTimelock.getCurrentAllowance();
        expect(allowance).to.equal(ethers.parseEther('10'));
      });
    });

    describe("getTotalTokensLocked", function () {
      it('Should return the correct total tokens locked', async function () {
        timelockReceiver1Address = await timelockReceiver1.getAddress();
        timelockReceiver2Address = await timelockReceiver2.getAddress();
        timelockReceiver3Address = await timelockReceiver3.getAddress();
        timelockReceiver4Address = await timelockReceiver4.getAddress();
        await batchTimelock.connect(deployer).addTimelock(timelockReceiver1Address, TIMELOCK_AMOUNT, TIMESTAMP_NOW, CLIFF_DURATION, VESTING_DURATION);
        await batchTimelock.connect(deployer).addTimelock(timelockReceiver2Address, TIMELOCK_AMOUNT, TIMESTAMP_NOW, CLIFF_DURATION, VESTING_DURATION);
        await batchTimelock.connect(deployer).addTimelock(timelockReceiver3Address, TIMELOCK_AMOUNT, TIMESTAMP_NOW, CLIFF_DURATION, VESTING_DURATION);
        await batchTimelock.connect(deployer).addTimelock(timelockReceiver4Address, TIMELOCK_AMOUNT, TIMESTAMP_NOW, CLIFF_DURATION, VESTING_DURATION);
        const totalTokensLocked = await batchTimelock.getTotalTokensLocked();
        expect(totalTokensLocked).to.equal(ethers.parseEther('4'));
      });

      it('Should return 0 if no tokens locked', async function () {
        const totalTokensLocked = await batchTimelock.getTotalTokensLocked();
        expect(totalTokensLocked).to.equal(0);
      });
    });

    describe("terminate and determinate functions", function () {
      const CLAIM_AMOUNT = ethers.parseEther("0.1");
      let timelockReceiver1Address: string;

      beforeEach(async function () {
        timelockReceiver1Address = await timelockReceiver1.getAddress();
        await batchTimelock.connect(deployer).addTimelock(timelockReceiver1Address, TIMELOCK_AMOUNT, TIMESTAMP_NOW, CLIFF_DURATION, VESTING_DURATION);
      });

      it("Should decrease withdrawable amount if terminated", async function () {
        const halfVestingTimestamp = TIMESTAMP_NOW + CLIFF_DURATION + (VESTING_DURATION / 2) + 1;
        await batchTimelock.connect(deployer).terminate(timelockReceiver1Address, halfVestingTimestamp);

        await ethers.provider.send("evm_increaseTime", [halfVestingTimestamp]);
        await ethers.provider.send("evm_mine", []);

        const withdrawableBalance = await batchTimelock.getClaimableBalance(timelockReceiver1Address);

        await expect(batchTimelock.connect(timelockReceiver1).claim(withdrawableBalance))
          .to.emit(batchTimelock, 'TokensClaimed')
          .withArgs(timelockReceiver1Address, withdrawableBalance);
      });

      it("Should re-enable claiming after determinate", async function () {
        const dateNow = Math.floor(Date.now() / 1000);
        await batchTimelock.connect(deployer).terminate(timelockReceiver1Address, dateNow);
        await batchTimelock.connect(deployer).determinate(timelockReceiver1Address);
        await expect(batchTimelock.connect(timelockReceiver1).claim(CLAIM_AMOUNT))
          .not.to.be.reverted;
      });
    });

    describe('getVestingPoolAddress', function () {
      it('Should return the correct vesting pool address', async function () {
        const vestingPoolAddress = await batchTimelock.getVestingPoolAddress();
        expect(vestingPoolAddress).to.equal(await vestingPool.getAddress());
      });
    });

    describe("getTokenAddress", function () {
      it('Should return the correct token address', async function () {
        const tokenAddress = await batchTimelock.getTokenAddress();
        expect(tokenAddress).to.equal(iqtMock.target);
      });
    });
  });
});