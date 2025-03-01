import { task, types } from 'hardhat/config';
import { BatchTimelock, BatchTimelock__factory } from '../typechain';
import fs from 'fs';
import path from 'path';
import csv from 'csv-parser';
import { ContractTransactionResponse, ethers } from 'ethers';
import { timelock } from '../typechain/contracts';
import { create } from 'domain';

const pause = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const createCSVFile = async (filePath: string, headers: string[]): Promise<void> => {
  try {
    // Ensure the directory exists.
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // If the file doesn't exist, create it with headers.
    if (!fs.existsSync(filePath)) {
      await fs.promises.writeFile(filePath, headers.join(',') + '\n', 'utf8');
      console.log(`CSV file created at: ${filePath}`);
    } else {
      console.log('CSV file already exists, skipping creation.');
    }
  } catch (error) {
    console.error('Error creating CSV file:', error);
    throw error;
  }
};

const appendRecordToCSV = async (
  filePath: string,
  address: string,
  newValue: string | number
): Promise<void> => {
  try {
    // Format the record as a CSV row.
    const record = `${address},${newValue}\n`;
    await fs.promises.appendFile(filePath, record, 'utf8');
    console.log(`Record appended: ${address}, ${newValue}`);
  } catch (error) {
    console.error('Error appending record to CSV file:', error);
    throw error;
  }
};

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

const timelockAmountLeft = async (
  timelockContract: BatchTimelock,
  receiverAddress: string,
): Promise<bigint> => {
  const timelock = await timelockContract.getTimelock(receiverAddress);

  if (!timelock) {
    throw new Error('Timelock not found');
  }

  console.log(`Locked: ${ethers.formatUnits(timelock.totalAmount, 18)} IQT`);
  console.log(`Claimed: ${ethers.formatUnits(timelock.releasedAmount, 18)} IQT`);

  return timelock.totalAmount - timelock.releasedAmount;
}


task('backup-timelock', 'Executes backup of unlock data for a set of addresses')
  .addParam('filepath', 'The input CSV file path', undefined, types.string, false)
  .addParam('outputFilepath', 'The output CSV file path', undefined, types.string, false)
  .addParam('batchTimelock', 'The BatchTimelock contract address', undefined, types.string, false)
  .addParam('startIteration', 'The iteration to start from', 0, types.int, true)
  .setAction(
    async (
      { filepath, outputFilepath, batchTimelock, startIteration },
      hre,
    ) => {

      if (!filepath) throw new Error('You must specify a CSV file path');
      if (!outputFilepath) throw new Error('You must specify an output CSV file path');
      if (!batchTimelock) throw new Error('You must specify a BatchTimelock contract address');
      if (!startIteration) {
        startIteration = 0;
      }

      createCSVFile(outputFilepath, ['staker', 'reward']);

      const { ethers } = hre;

      const receivers = await readReceiversFromCSV(filepath);

      const formattedReceivers = (receivers as any).map((receiver: any) => ({
        receiver: receiver.staker,
        totalAmount: receiver.reward,
      }));

      const [deployer] = await ethers.getSigners();
      const batchTimelockContract = BatchTimelock__factory.connect(batchTimelock, deployer);

      console.log('Starting process.');

      for (let i = startIteration; i < formattedReceivers.length; i++) {
        console.log(`Processing (${i + 1}/${formattedReceivers.length}).`);
        console.log(`Iteration number: ${i}`);
        console.log(`Address ${formattedReceivers[i].receiver}`);

        const iqtLeft = await timelockAmountLeft(
          batchTimelockContract,
          formattedReceivers[i].receiver,
        );

        console.log(`Not-claimed tokens: ${ethers.formatUnits(iqtLeft, 18)} IQT`);
        await appendRecordToCSV(outputFilepath, formattedReceivers[i].receiver, iqtLeft.toString());

        console.log('Waiting 1.5 seconds before next iteration...');
        console.log('----------------------------------------------------------------------');
        await pause(1500);
      }

      console.log('Timelocks added successfully.');
    });