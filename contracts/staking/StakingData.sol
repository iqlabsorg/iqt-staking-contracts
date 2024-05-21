// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "../staking/IStakingData.sol";

contract StakingData is IStakingData {
  uint256 public constant USER_STAKES_LIMIT = 10;

  /**
   * @dev Staking management contract.
  */
  IStakingManagement internal stakingManagement;

  /**
   * @dev Staking contract.
  */
  IStaking internal staking;

  /**
   * @dev Staking pool size.
  */
  uint256 internal stakingPoolSize;

  /**
   * @dev Initializes the contract.
  */
  constructor(
    IStakingManagement _stakingManagement,
    IStaking _staking,
    uint256 _stakingPoolSize
  ) {
    stakingManagement = _stakingManagement;
    staking = _staking;
    stakingPoolSize = _stakingPoolSize;
  }

  /**
   * @inheritdoc IStakingData
   */
  function setStakingPoolSize(uint256 _stakingPoolSize) external override {
    stakingPoolSize = _stakingPoolSize;
  }

  /**
   * @inheritdoc IStakingData
   */
  function getBaseStakingData(address staker) external override view returns (BaseStakingData memory) {
    bool earlyWithdrawalAllowed = stakingManagement.isWithdrawEnabled();
    (uint256 minimumStake, uint256 maximumStake) = stakingManagement.getStakingLimits();
    uint256 stakingPoolLeft = staking.getRewardPoolLeft();
    uint256 totalTokensStaked = staking.getTotalTokensStaked();

    IStakingManagement.StakingPlan[] memory stakingPlans;
    uint256[] memory stakingPlanIds;

    (stakingPlans, stakingPlanIds) = stakingManagement.getStakingPlans(0, stakingManagement.getStakingPlansAmount());

    (uint256 totalEarningsInTokens, uint256 totalEarningsInPercentage) = staking.calculateTotalEarnings(staker);

    return BaseStakingData({
      earlyWithdrawalAllowed: earlyWithdrawalAllowed,
      minimumStake: minimumStake,
      maximumStake: maximumStake,
      stakingPoolSize: stakingPoolSize,
      stakingPoolLeft: stakingPoolLeft,
      totalTokensStaked: totalTokensStaked,
      stakingPlans: stakingPlans,
      stakingPlanIds: stakingPlanIds,
      totalEarningsInTokens: totalEarningsInTokens,
      totalEarningsPercentage: totalEarningsInPercentage
    });
  }

  /**
   * @inheritdoc IStakingData
   */
  function getStakes(
    address staker,
    uint256 offset,
    uint256 limit
  ) external view returns (
    IStaking.Stake[] memory,
    uint256[] memory ,
    IStaking.StakeEarnings[] memory
  ) {
    return staking.getStakesWithIdsAndEarnings(staker, offset, limit);
  }

  /**
   * @inheritdoc IStakingData
   */
  function getTotalEarnings(address staker) external view override returns (uint256, uint256) {
    return staking.calculateTotalEarnings(staker);
  }

  /**
   * @inheritdoc IStakingData
   */
  function getStakingManagement() external view override returns (IStakingManagement) {
    return stakingManagement;
  }

  /**
   * @inheritdoc IStakingData
   */
  function getStaking() external view override returns (IStaking) {
    return staking;
  }

  /**
   * @inheritdoc IStakingData
   */
  function getStakingPoolSize() external view override returns (uint256) {
    return stakingPoolSize;
  }
}