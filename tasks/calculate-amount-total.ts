import { task, types } from 'hardhat/config';
import fs from 'fs';

task("amount-total", "Sums the reward values from a CSV file")
  .addParam("filepath", "The path to the CSV file", undefined, types.string, false)
  .setAction(async ({ filepath }, hre) => {
    if (!filepath) {
      console.error("You must specify a CSV file path");
    }

    if (!fs.existsSync(filepath)) {
      console.error(`CSV file not found at ${filepath}`);
      process.exit(1);
    }

    // Read the CSV file and split into lines.
    const csvContent = fs.readFileSync(filepath, "utf8").trim();
    const lines = csvContent.split("\n");

    // Check if CSV has a header and at least one data line.
    if (lines.length < 2) {
      console.error("CSV file does not contain data rows.");
      process.exit(1);
    }

    // Initialize total as a BigNumber zero.
    let total = 0n;

    console.log('Total:', total.toString());

    // Assuming the first line is header, iterate over the data rows.
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      // Split by comma to extract the staker and reward.
      const [_, reward] = line.split(",");
      // Clean the reward value (remove any quotes or extra spaces).
      const cleanReward = reward.trim().replace(/,/g, "").replace(/"/g, "");

      try {
        total += BigInt(cleanReward);
      } catch (error) {
        console.error(`Error converting reward to BigInt on line ${i + 1}:`, error);
        process.exit(1);
      }
    }

    console.log("Total rewards (wei):", total.toString());
    const totalIQT = hre.ethers.formatUnits(total.toString(), 18);
    console.log("Total rewards (IQT):", totalIQT);
  });
