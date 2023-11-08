import { HardhatUserConfig } from 'hardhat/config';
import '@typechain/hardhat';
import 'hardhat-deploy';
import '@nomicfoundation/hardhat-chai-matchers';
import '@nomicfoundation/hardhat-ethers';
import '@nomicfoundation/hardhat-verify';
import '@nomicfoundation/hardhat-toolbox';
import * as dotenv from 'dotenv';

const env = dotenv.config();

import './tasks/deploy-iqt-mock';
import './tasks/deploy-batch-timelock';
import './tasks/deploy-staking';
import './tasks/deploy-staking-management';

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
    ethereum: {
      url: `https://rpc.ankr.com/eth/${process.env.ANKR_PROJECT_KEY}`,
      gasPrice: 300_000000000,
      gasMultiplier: 2,
      timeout: 40000,
    },
    ethereumGoerli: {
      url: `https://rpc.ankr.com/eth_goerli/${process.env.ANKR_PROJECT_KEY}`,
      timeout: 40000,
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
  paths: {
    sources: './contracts',
    tests: './test',
    cache: './cache',
    artifacts: './artifacts',
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
    target: 'ethers-v6',
  },
};

export default config;
