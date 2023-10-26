import { TASK_TEST_SETUP_TEST_ENVIRONMENT } from "hardhat/builtin-tasks/task-names";
import { subtask, task, types } from "hardhat/config";
// import { IQMarketingRaffleCollection } from "../typechain";
import chaiAsPromised from "chai-as-promised";
import chai from "chai";

// import "./utils";
// import "./deploy";

//eslint-disable-next-line @typescript-eslint/require-await
subtask(TASK_TEST_SETUP_TEST_ENVIRONMENT, async (): Promise<void> => {
  //eslint-disable-next-line @typescript-eslint/no-unsafe-argument
  chai.use(chaiAsPromised);
});

// task("deploy:setup", "Deploy the whole set of contract for IQ NFT Collection")
//   .addParam("name", "Token name", undefined, types.string, false)
//   .addParam("symbol", "Token symbol", undefined, types.string, false)
//   .addParam("totalSupply", "Token supply", undefined, types.int, false)
//   .addParam("newOwner", "Tokens owner", undefined, types.string, true)
//   .addParam("baseUri", "Token base URI", undefined, types.string, true)
//   .setAction(
//     async (
//       args: {
//         name: string;
//         symbol: string;
//         totalSupply: number;
//         newOwner: string | undefined;
//         baseUri: string | undefined;
//       },
//       hre
//     ) => {
//       console.log();
//       console.log(
//         "#############################################################"
//       );
//       console.log("# Deploying IQ NFT Collection contracts #");
//       console.log(
//         "#############################################################"
//       );
//       console.log();

//       // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
//       const nftCollection: IQMarketingRaffleCollection = await hre.run(
//         "deploy:marketing-raffle",
//         {
//           name: args.name,
//           symbol: args.symbol,
//           totalSupply: args.totalSupply,
//           newOwner: args.newOwner,
//           baseUri: args.baseUri,
//         }
//       );

//       return nftCollection;
//     }
//   );
