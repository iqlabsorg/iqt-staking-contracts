import { task, types } from 'hardhat/config';
import { BatchTimelock__factory } from '../typechain';
import fs from 'fs';

const pause = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

task('get:timelocks', 'Gets a batch of timelocks for a list of addresses from a file')
  .addParam('contract', 'The BatchTimelock contract address', undefined, types.string, false)
  .addParam('filepath', 'The file path for the list of addresses', undefined, types.string, false)
  .setAction(
    async ({ contract, filepath }, hre) => {
      if (!contract) throw new Error('You must specify a BatchTimelock contract address');
      if (!filepath) throw new Error('You must specify a file path');

      const { ethers } = hre;
      const [deployer] = await ethers.getSigners();
      const batchTimelockContract = BatchTimelock__factory.connect(contract, deployer);

      // Read addresses from file
      const addresses = fs.readFileSync(filepath, 'utf8').split('\n').map(line => line.trim()).filter(line => line);

      // Check if file exists, and if not, add header
      const filePath = 'result.csv';
      if (!fs.existsSync(filePath)) {
        const csvHeader = 'Address,Active,TotalAmount,ClaimedAmount,TimelockFrom,CliffDuration,VestingDuration,Revoked\n';
        fs.writeFileSync(filePath, csvHeader, 'utf8');
      }

      for (const address of addresses) {
        try {
          const timelock = await batchTimelockContract.getTimelock(address);

          // Convert timelock result to the desired format
          const timelockArray = timelock.map((item: any) => item.toString());
          const timelockString = `${address},${timelockArray.join(',')}\n`;

          console.log(`Timelock for ${address}: ${timelockString}`);

          // Append result to the CSV file
          fs.appendFileSync(filePath, timelockString, 'utf8');

        } catch (error) {
          console.error(`Failed to get timelock for address ${address}:`, error);
          throw new Error(`Execution stopped due to error: ${error.message}`);
        }

        await pause(100);
      }

      console.log('Timelocks added successfully.');
    }
  );

export default {};

//npx hardhat get:timelock-batch --network polygon --contract 0x29E5385d5b418FC71A379A5AbE11E9420f7077B2 --filepath addresses.txt