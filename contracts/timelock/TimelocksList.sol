// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./ITimelocksList.sol";

contract TimelocksList is ITimelocksList {
  /**
   * @dev Address of the timelock contract for 12 months.
   */
  IBatchTimelock public _twelveMonthsTimelock;

  /**
   * @dev Address of the timelock contract for 18 months.
   */
  IBatchTimelock public _eighteenMonthsTimelock;

  /**
   * @dev Address of the timelock contract for 24 months.
   */
  IBatchTimelock public _twentyFourMonthsTimelock;

  constructor(
    IBatchTimelock twelveMonthsTimelock,
    IBatchTimelock eighteenMonthsTimelock,
    IBatchTimelock twentyFourMonthsTimelock
  ) {
    _twelveMonthsTimelock = twelveMonthsTimelock;
    _eighteenMonthsTimelock = eighteenMonthsTimelock;
    _twentyFourMonthsTimelock = twentyFourMonthsTimelock;
  }

  /**
   * @inheritdoc ITimelocksList
   */
  function getTwelveMonthsTimelockAddress() external view returns (address) {
    return address(_twelveMonthsTimelock);
  }

  /**
   * @inheritdoc ITimelocksList
   */
  function getEighteenMonthsTimelockAddress() external view returns (address) {
    return address(_eighteenMonthsTimelock);
  }

  /**
   * @inheritdoc ITimelocksList
   */
  function getTwentyFourMonthsTimelockAddress() external view returns (address) {
    return address(_twentyFourMonthsTimelock);
  }

  /**
   * @inheritdoc ITimelocksList
   */
  function getClaimableBalances(address _receiver) public view override returns (uint256[3] memory claimableBalances) {
    claimableBalances[0] = _twelveMonthsTimelock.getClaimableBalance(_receiver);
    claimableBalances[1] = _eighteenMonthsTimelock.getClaimableBalance(_receiver);
    claimableBalances[2] = _twentyFourMonthsTimelock.getClaimableBalance(_receiver);
  }

  /**
   * @inheritdoc ITimelocksList
   */
  function getTimelocks(address _receiver) public view override returns (IBatchTimelock.Timelock[3] memory timelocks) {
    timelocks[0] = _twelveMonthsTimelock.getTimelock(_receiver);
    timelocks[1] = _eighteenMonthsTimelock.getTimelock(_receiver);
    timelocks[2] = _twentyFourMonthsTimelock.getTimelock(_receiver);
  }

  /**
   * @inheritdoc ITimelocksList
   */
  function getTimelocksData(address _receiver) external view override returns(
    uint256[3] memory claimableBalances,
    IBatchTimelock.Timelock[3] memory timelocks,
    uint256 totalClaimableBalance,
    address twelveMonthsTimelockAddress,
    address eighteenMonthsTimelockAddress,
    address twentyFourMonthsTimelockAddress
  ) {
    claimableBalances = getClaimableBalances(_receiver);
    timelocks = getTimelocks(_receiver);
    totalClaimableBalance = claimableBalances[0] + claimableBalances[1] + claimableBalances[2];
    twelveMonthsTimelockAddress = address(_twelveMonthsTimelock);
    eighteenMonthsTimelockAddress = address(_eighteenMonthsTimelock);
    twentyFourMonthsTimelockAddress = address(_twentyFourMonthsTimelock);
  }
}