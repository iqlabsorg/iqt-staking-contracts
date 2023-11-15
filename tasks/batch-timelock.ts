import { task } from "hardhat/config";
import { BatchTimelock__factory } from "../typechain";
import fs from "fs";
import csv from "csv-parser";

task("add:timelock-batch", "Adds a batch of timelocks from a CSV file")
  .addParam("filepath", "The CSV file path", undefined, undefined, false)
  .addParam("batchTimelock", "The BatchTimelock contract address", undefined, undefined, false)
  .setAction(async ({ filepath, batchTimelock }, hre) => {
    const { ethers } = hre;
    const CLIFF_DURATION = 15780000; // 6 months
    const TIMELOCK_FROM = 1700492400; // Mon Nov 20 2023 15:00:00 GMT+0000
    const ITERATIONS_AMOUNT = 10; // Number of batches to split the array

    const readReceiversFromCSV = (filePath: string) => {
      return new Promise((resolve, reject) => {
        const receivers: object[] = [];
        fs.createReadStream(filePath)
          .pipe(csv())
          .on("data", (data) => receivers.push(data))
          .on("end", () => resolve(receivers))
          .on("error", reject);
      });
    };

    const receivers = await readReceiversFromCSV(filepath);
    const formattedReceivers = (receivers as any).map((receiver: any) => ({
      receiver: receiver.address,
      totalAmount: ethers.parseEther(receiver.totalAmount),
      timelockFrom: Number(receiver.timelockFrom),
      cliffDuration: CLIFF_DURATION,
      vestingDuration: Number(receiver.vestingDuration)
    }));

    const [deployer] = await ethers.getSigners();
    const batchTimelockContract = BatchTimelock__factory.connect(batchTimelock, deployer);
    const batchLength = Math.ceil(formattedReceivers.length / ITERATIONS_AMOUNT);

    for (let i = 0; i < ITERATIONS_AMOUNT; i++) {
      const batch = formattedReceivers.slice(i * batchLength, (i + 1) * batchLength);
      const tx = await batchTimelockContract.addTimelockBatch(batch);
      console.log(`Batch ${i + 1} transaction hash: ${tx.hash}`);
      await tx.wait();
    }

    console.log("Timelocks added successfully.");
  });

export default {};
