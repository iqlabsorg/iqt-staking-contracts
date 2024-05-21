// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./IBatchTimelock.sol";

interface ITimelocksList {
  /**
   * @dev Returns the address of the timelock contract for 12 months.
   * @return The address of the timelock contract for 12 months.
  */
  function getTwelveMonthsTimelockAddress() external view returns (address);

  /**
   * @dev Returns the address of the timelock contract for 18 months.
   * @return The address of the timelock contract for 18 months.
  */
  function getEighteenMonthsTimelockAddress() external view returns (address);

  /**
   * @dev Returns the address of the timelock contract for 24 months.
   * @return The address of the timelock contract for 24 months.
  */
  function getTwentyFourMonthsTimelockAddress() external view returns (address);

  /**
   * @dev Returns the claimable balances of the receiver.
   * @param _receiver The address of the receiver.
   * @return claimableBalances The claimable balances of the receiver.
  */
  function getClaimableBalances(address _receiver) external view returns (uint256[3] memory claimableBalances);

  /**
   * @dev Returns the timelocks of the receiver.
   * @param _receiver The address of the receiver.
   * @return timelocks The timelocks of the receiver.
  */
  function getTimelocks(address _receiver) external view returns (IBatchTimelock.Timelock[3] memory timelocks);

  /**
   * @dev Returns the timelocks data of the receiver.
   * @param _receiver The address of the receiver.
   * @return claimableBalances The claimable balances of the receiver.
   * @return timelocks The timelocks of the receiver.
   * @return totalClaimableBalance The total claimable balance of the receiver.
   * @return twelveMonthsTimelockAddress The address of the timelock contract for 12 months.
   * @return eighteenMonthsTimelockAddress The address of the timelock contract for 18 months.
   * @return twentyFourMonthsTimelockAddress The address of the timelock contract for 24 months.
  */
  function getTimelocksData(address _receiver) external view returns (
    uint256[3] memory claimableBalances,
    IBatchTimelock.Timelock[3] memory timelocks,
    uint256 totalClaimableBalance,
    address twelveMonthsTimelockAddress,
    address eighteenMonthsTimelockAddress,
    address twentyFourMonthsTimelockAddress
  );
}