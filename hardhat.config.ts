/* eslint-disable multiline-ternary */
import * as dotenv from 'dotenv';

import { HardhatUserConfig } from 'hardhat/config';
import '@nomiclabs/hardhat-waffle';
import '@nomiclabs/hardhat-ethers';
import '@typechain/hardhat';
import 'hardhat-gas-reporter';
import 'hardhat-contract-sizer';
import 'solidity-coverage';
import 'hardhat-deploy';
import '@nomiclabs/hardhat-etherscan';
import '@openzeppelin/hardhat-upgrades';
import '@iqprotocol/iq-space-protocol/tasks';
// import "./test/assertions";
import { IQSpaceV2SupportedChainNetworks } from '@iqprotocol/iq-space-sdk-js';

const env = dotenv.config();
const processError = (e: string): void =>
  console.log(
    `
Cannot load tasks. Need to generate typechain types.
This is the expected behaviour on first time setup.`,
    `Missing type trace: ${e.toString()}`,
  );
import('./tasks').catch(processError);

const DEPLOYMENT_PRIVATE_KEY = env.parsed?.DEPLOYMENT_PRIVATE_KEY;
const ANKR_PROJECT_KEY = env.parsed?.ANKR_PROJECT_KEY;
const ETHERSCAN_API_KEY_POLYGON = env.parsed?.ETHERSCAN_API_KEY_POLYGON;

const accounts = DEPLOYMENT_PRIVATE_KEY ? [DEPLOYMENT_PRIVATE_KEY] : [];
const ankrProjectKey = ANKR_PROJECT_KEY ? ANKR_PROJECT_KEY : '';
const etherscanApiKeyPolygon = ETHERSCAN_API_KEY_POLYGON ? ETHERSCAN_API_KEY_POLYGON : '';

const config: HardhatUserConfig = {
  solidity: {
    version: '0.8.19',
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  namedAccounts: {
    deployer: 0,
  },
  networks: {
    [IQSpaceV2SupportedChainNetworks.POLYGON_MAINNET]: {
      url: `https://rpc.ankr.com/polygon/${ankrProjectKey}`,
      accounts,
      gasPrice: 300_000000000,
      gasMultiplier: 2,
      timeout: 40000,
    },
    [IQSpaceV2SupportedChainNetworks.POLYGON_MUMBAI_TESTNET]: {
      url: `https://rpc.ankr.com/polygon_mumbai/${ankrProjectKey}`,
      accounts,
    },
    bscTestnet: {
      url: 'https://data-seed-prebsc-1-s1.binance.org:8545/',
      accounts,
    },
  },
  etherscan: {
    apiKey: {
      polygon: etherscanApiKeyPolygon,
      polygonMumbai: etherscanApiKeyPolygon,
      bscTestnet: 'TTWE1EGN7G8VFWP78UJXGBAFJMV9XIHRA6',
    },
    customChains: [],
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS !== undefined,
    currency: 'USD',
  },
  external: {
    contracts: [
      {
        artifacts: 'node_modules/@iqprotocol/iq-space-protocol/artifacts',
        deploy: 'node_modules/@iqprotocol/iq-space-protocol/deploy',
      },
    ],
  },
  typechain: {
    outDir: 'typechain',
    target: 'ethers-v5',
  },
};

export default config;
