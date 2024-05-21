import { task, types } from 'hardhat/config';
import { BatchTimelock__factory } from '../typechain';
import fs from 'fs';
import csv from 'csv-parser';

const pause = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

task('add:timelock-batch', 'Adds a batch of timelocks from a CSV file')
  .addParam('filepath', 'The CSV file path', undefined, types.string, false)
  .addParam('batchTimelock', 'The BatchTimelock contract address', undefined, types.string, false)
  .addParam('timelockFrom', 'The timelock start date', undefined, types.int, false)
  .addParam('cliffDuration', 'The cliff duration in seconds', undefined, types.int, false)
  .addParam('vestingDuration', 'The vesting duration in seconds', undefined, types.int, false)
  .addParam('iterations', 'The number of batches to split the array', undefined, types.int, false)
  .addParam('startIteration', 'The iteration to start from', 0, types.int, true)
  .setAction(
    async (
      { filepath, batchTimelock, timelockFrom, cliffDuration, vestingDuration, iterations, startIteration },
      hre,
    ) => {
      if (!filepath) throw new Error('You must specify a CSV file path');
      if (!batchTimelock) throw new Error('You must specify a BatchTimelock contract address');
      if (!timelockFrom) throw new Error('You must specify a timelock start date');
      if (!cliffDuration) throw new Error('You must specify a cliff duration in seconds');
      if (!vestingDuration) throw new Error('You must specify a vesting duration in seconds');
      if (!iterations) throw new Error('You must specify the number of batches to split the array');
      if (!startIteration) {
        startIteration = 0;
      }

      const { ethers } = hre;

      const readReceiversFromCSV = (filePath: string): Promise<any[]> => {
        return new Promise((resolve, reject) => {
          const receivers: object[] = [];
          fs.createReadStream(filePath)
            .pipe(csv())
            .on('data', data => receivers.push(data))
            .on('end', () => resolve(receivers))
            .on('error', reject);
        });
      };

      const receivers = await readReceiversFromCSV(filepath);

      const formattedReceivers = (receivers as any).map((receiver: any) => ({
        receiver: receiver.staker,
        totalAmount: receiver.reward,
        timelockFrom: timelockFrom,
        cliffDuration: cliffDuration,
        vestingDuration: vestingDuration,
      }));

      const [deployer] = await ethers.getSigners();
      const batchTimelockContract = BatchTimelock__factory.connect(batchTimelock, deployer);

      const batchLength = Math.ceil(formattedReceivers.length / iterations);

      for (let i = startIteration; i < iterations; i++) {
        console.log('Starts at: ', i * batchLength, 'ends at: ', (i + 1) * batchLength);
        const batch = formattedReceivers.slice(i * batchLength, (i + 1) * batchLength);

        console.log('Running Batch: ', i + 1);

        const gasPrice = (await hre.ethers.provider.getFeeData()).gasPrice;

        if (!gasPrice) throw new Error('No gas price found');
        else {
          console.log('Gas Price', ethers.formatUnits(gasPrice.toString(), 'gwei').toString());
        }

        const estimate = await batchTimelockContract.addTimelockBatch.estimateGas(batch);

        console.log('Estimate', estimate);

        const tx = await batchTimelockContract.addTimelockBatch(batch, {
          gasLimit: estimate,
          // gasPrice: '50000000000',
          gasPrice: '50000000000',
        });

        console.log(`Batch ${i + 1} transaction hash: ${tx.hash}`);

        const receipt = await tx.wait();

        console.log('Receipt', receipt);

        await pause(10000);
      }

      console.log('Timelocks added successfully.');
    },
  );

export default {};
