// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "../staking-management/IStakingManagement.sol";
import "./IStaking.sol";

interface IStakingData {
  /**
   * @dev Data structure for base staking data.
   * @param earlyWithdrawalAllowed Whether early withdrawal is allowed.
   * @param minimumStake Minimum stake.
   * @param maximumStake Maximum stake.
   * @param stakingPoolSize Staking pool size.
   * @param stakingPlans Array of staking plans.
   * @param stakingPlanIds Array of staking plan IDs.
   * @param totalEarningsInTokens Total earnings in tokens.
   * @param totalEarningsPercentage Total earnings percentage.
   */
  struct BaseStakingData {
    bool earlyWithdrawalAllowed;
    uint256 minimumStake;
    uint256 maximumStake;
    uint256 stakingPoolSize;
    uint256 stakingPoolLeft;
    uint256 totalTokensStaked;
    IStakingManagement.StakingPlan[] stakingPlans;
    uint256[] stakingPlanIds;
    uint256 totalEarningsInTokens;
    uint256 totalEarningsPercentage;
  }

  /**
   * @dev Sets staking pool size.
   * @param _stakingPoolSize Staking pool size.
   */
  function setStakingPoolSize(uint256 _stakingPoolSize) external;

  /**
   * @dev Returns base staking data.
   * @param staker Staker address.
   * @return BaseStakingData Base staking data.
   */
  function getBaseStakingData(address staker) external view returns (BaseStakingData memory);

  /**
   * @dev Returns staking plans.
   * @param staker Staker address.
   * @return Array of staking plans.
   * @return Array of staking plan IDs.
   */
  function getStakes(
    address staker,
    uint256 offset,
    uint256 limit
  ) external view returns (IStaking.Stake[] memory, uint256[] memory, IStaking.StakeEarnings[] memory);

  /**
   * @dev Returns total earnings.
   * @param staker Staker address.
   * @return Total earnings in tokens.
   * @return Total earnings in percentage.
   */
  function getTotalEarnings(address staker) external view returns (uint256, uint256);

  /**
   * @dev Returns staking management contract.
   * @return Staking management contract.
   */
  function getStakingManagement() external view returns (IStakingManagement);

  /**
   * @dev Returns staking contract.
   * @return Staking contract.
   */
  function getStaking() external view returns (IStaking);

  /**
   * @dev Returns staking pool size.
   * @return Staking pool size.
   */
  function getStakingPoolSize() external view returns (uint256);
}