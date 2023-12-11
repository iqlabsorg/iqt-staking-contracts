import { task, types } from "hardhat/config";
import { BatchTimelock__factory } from "../typechain";
import fs from "fs";
import csv from "csv-parser";

task("add:timelock-batch", "Adds a batch of timelocks from a CSV file")
  .addParam("filepath", "The CSV file path", undefined, types.string, false)
  .addParam("batchTimelock", "The BatchTimelock contract address", undefined, types.string, false)
  .addParam("timelockFrom", "The timelock start date", undefined, types.int, false)
  .addParam("cliffDuration", "The cliff duration in seconds", undefined, types.int, false)
  .addParam("vestingDuration", "The vesting duration in seconds", undefined, types.int, false)
  .addParam("iterations", "The number of batches to split the array", undefined, types.int, false)
  .setAction(async ({ filepath, batchTimelock, timelockFrom, cliffDuration, vestingDuration, iterations }, hre) => {

    if (!filepath) throw new Error("You must specify a CSV file path");
    if (!batchTimelock) throw new Error("You must specify a BatchTimelock contract address");
    if (!timelockFrom) throw new Error("You must specify a timelock start date");
    if (!cliffDuration) throw new Error("You must specify a cliff duration in seconds");
    if (!vestingDuration) throw new Error("You must specify a vesting duration in seconds");
    if (!iterations) throw new Error("You must specify the number of batches to split the array");

    const { ethers } = hre;

    const readReceiversFromCSV = (filePath: string): Promise<any[]> => {
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
      receiver: receiver.staker,
      totalAmount: ethers.parseEther(receiver.reward),
      timelockFrom: timelockFrom,
      cliffDuration: cliffDuration,
      vestingDuration: vestingDuration
    }));

    const [deployer] = await ethers.getSigners();
    const batchTimelockContract = BatchTimelock__factory.connect(batchTimelock, deployer);
    const batchLength = Math.ceil(formattedReceivers.length / iterations);

    for (let i = 0; i < iterations; i++) {
      const batch = formattedReceivers.slice(i * batchLength, (i + 1) * batchLength);
      const estimate = await batchTimelockContract.addTimelockBatch.estimateGas(batch);

      console.log('Estimate', estimate);

      await new Promise(resolve => setTimeout(resolve, 1000));

      // const tx = await batchTimelockContract.addTimelockBatch(batch);
      // console.log(`Batch ${i + 1} transaction hash: ${tx.hash}`);
      // await tx.wait();
    }

    console.log("Timelocks added successfully.");
  });

export default {};
