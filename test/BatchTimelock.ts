import { expect } from "chai";
import { ethers, run } from "hardhat";
import { BigNumberish, Signer } from "ethers";
import { BatchTimelock, IQTMock } from "../typechain";

describe("BatchTimelock Contract", function () {
  let deployer: Signer;
  let vestingPool: Signer;
  let stranger: Signer;
  let timelockReceiver1: Signer;
  let timelockReceiver2: Signer;
  let timelockReceiver3: Signer;
  let iqtMock: IQTMock;
  let batchTimelock: BatchTimelock;

  const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

  beforeEach(async function () {
    const accounts = await ethers.getSigners();
    deployer = accounts[0];
    vestingPool = accounts[1];
    stranger = accounts[2];
    timelockReceiver1 = accounts[3];
    timelockReceiver2 = accounts[4];
    timelockReceiver3 = accounts[5];

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

    it("Should set the deployer as the owner", async function () {
      expect(await batchTimelock.owner()).to.equal(await deployer.getAddress());
    });
  });

  describe("Functionality", function () {
    const CLIFF_DURATION = 15_780_000; // 6 months in seconds
    const VESTING_DURATION = 31_536_000; // 1 year in seconds
    const TIMELOCK_AMOUNT: BigNumberish = ethers.parseEther('1');
    const TIMESTAMP_NOW = Math.floor(Date.now() / 1000);

    let timelockReceiver1Address: string;
    let timeLockReceiver2Address: string;

    describe("addTimelock", function () {
      beforeEach(async function () {
        timelockReceiver1Address = await timelockReceiver1.getAddress();
        timeLockReceiver2Address = await timelockReceiver2.getAddress();
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

    describe("claim", function () {
      const TIMELOCK_AMOUNT: BigNumberish = ethers.parseEther('1');
      const CLAIM_AMOUNT = ethers.parseEther("0.1");

      let timelockReceiver1Address: string;

      beforeEach(async function () {
        timelockReceiver1Address = await timelockReceiver1.getAddress();
        const dateNow = Math.floor(Date.now() / 1000);
        console.log('DATENOW ', dateNow);
        await batchTimelock.connect(deployer).addTimelock(
          timelockReceiver1Address,
          TIMELOCK_AMOUNT,
          TIMESTAMP_NOW,
          CLIFF_DURATION,
          VESTING_DURATION
        );
      });

      it("Should fail to claim with stranger address", async function () {
        await expect(batchTimelock.connect(stranger).claim(ethers.parseEther("0.1")))
          .to.be.revertedWithCustomError(batchTimelock, "InvalidReceiverAddress");
      });

      it("Should fail to claim with stranger address", async function () {
        await expect(batchTimelock.connect(timelockReceiver1).claim(0))
          .to.be.revertedWithCustomError(batchTimelock, "ZeroClaimAmount");
      });

      it("Should fail to claim if terminated", async function () {
        const dateNow = Math.floor(Date.now() / 1000);
        await batchTimelock.connect(deployer).terminate(timelockReceiver1Address, dateNow);
        await expect(batchTimelock.connect(timelockReceiver1).claim(ethers.parseEther("0.1")))
          .to.be.revertedWithCustomError(batchTimelock, "TimelockIsTerminated");
      });

      it("Should fail to claim if amount is higher than withdrawable", async function () {
         // Fast-forward time by 6 months + 1 month
         await ethers.provider.send("evm_increaseTime", [CLIFF_DURATION + 2_628_000]);
         await ethers.provider.send("evm_mine", []);

         await expect(batchTimelock.connect(timelockReceiver1).claim(CLAIM_AMOUNT))
           .to.be.revertedWithCustomError(batchTimelock, "AmountExceedsWithdrawableAllowance");;
      });

      it("Should fail to claim if token transfer is failed", async function () {
        const deployerAddress = await deployer.getAddress();
        await iqtMock.connect(vestingPool).transfer(deployerAddress, ethers.parseEther('10'));
        // Fast-forward time by 6 months + 1 month
        await ethers.provider.send("evm_increaseTime", [CLIFF_DURATION + 2_628_000]);
        await ethers.provider.send("evm_mine", []);

        await expect(batchTimelock.connect(timelockReceiver1).claim(CLAIM_AMOUNT))
          .to.be.revertedWith('ERC20: transfer amount exceeds balance');
      });

      it("Should allow partial claim and update released amount", async function () {
        // Fast-forward time by 6 months + 1 month
        await ethers.provider.send("evm_increaseTime", [CLIFF_DURATION + 2_628_000]);
        await ethers.provider.send("evm_mine", []);

        await expect(batchTimelock.connect(timelockReceiver1).claim(CLAIM_AMOUNT))
          .to.emit(batchTimelock, 'TokensClaimed')
          .withArgs(timelockReceiver1Address, CLAIM_AMOUNT);

        const timelock = await batchTimelock.getTimelock(timelockReceiver1Address);
        expect(timelock.releasedAmount).to.equal(CLAIM_AMOUNT);
      });
    });

    describe("terminate and determinate functions", function () {
      const CLAIM_AMOUNT = ethers.parseEther("0.1");
      let timelockReceiver1Address: string;

      beforeEach(async function () {
        timelockReceiver1Address = await timelockReceiver1.getAddress();
        await batchTimelock.connect(deployer).addTimelock(timelockReceiver1Address, TIMELOCK_AMOUNT, TIMESTAMP_NOW, CLIFF_DURATION, VESTING_DURATION);
      });

      it("Should disable claiming after termination", async function () {
        const dateNow = Math.floor(Date.now() / 1000);
        await batchTimelock.connect(deployer).terminate(timelockReceiver1Address, dateNow);

        await expect(batchTimelock.connect(timelockReceiver1).claim(CLAIM_AMOUNT))
          .to.be.revertedWithCustomError(batchTimelock, "TimelockIsTerminated");
      });

      it("Should re-enable claiming after determinate", async function () {
        const dateNow = Math.floor(Date.now() / 1000);
        await batchTimelock.connect(deployer).terminate(timelockReceiver1Address, dateNow);
        await batchTimelock.connect(deployer).determinate(timelockReceiver1Address);
        await expect(batchTimelock.connect(timelockReceiver1).claim(CLAIM_AMOUNT))
          .not.to.be.reverted;
      });
    });
  });
});