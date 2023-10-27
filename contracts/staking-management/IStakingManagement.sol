// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

interface IStakingManagement {
    /**
     * @dev Reverts if the staking plan does not exist.
     * @param planId Unique ID of the staking plan.
     */
    error StakingPlanDoesNotExist(uint256 planId);

    /**
     * @dev Reverts if the duration is not greater than zero.
     */
    error DurationMustBeGreaterThanZero();

    /**
     * @dev Reverts if the APY is not within range (min=1,max=10000).
     */
    error APYMustBeWithinRange();

    /**
     * @dev Reverts if the minimum stake is bigger or not equal to the maximum stake.
     */
    error MinimumStakeMustBeLessThanOrEqualToMaximumStake();

    /**
     * @dev Emitted when a staking plan is added.
     * @param planId Staking plan ID.
     * @param duration Stake duration (in seconds).
     * @param apy Annual Percentage Yield.
     */
    event StakingPlanAdded(uint256 planId, uint256 duration, uint16 apy);

    /**
     * @dev Emitted when a staking plan is updated.
     * @param planId Updated stake plan ID.
     * @param duration Updated stake duration (in seconds).
     * @param apy Updated Annual Percentage Yield.
     */
    event StakingPlanUpdated(uint256 planId, uint256 duration, uint16 apy);

    /**
     * @dev Emitted when a staking plan is removed.
     * @param planId Removed staking plan ID.
     */
    event StakingPlanRemoved(uint256 planId);

    /**
     * @dev Staking plan data.
     * @param duration Duration of the staking plan (in seconds).
     * @param apy Annual Percentage Rate of the staking plan.
     */
    struct StakingPlan {
        uint256 duration;
        uint16 apy;
    }

    /**
     * @dev Add a new staking plan.
     * @param duration Duration of the staking plan (in seconds).
     * @param apy Annual Percentage Rate of the staking plan.
     * @return Unique ID of the staking plan.
     */
    function addStakingPlan(uint256 duration, uint16 apy) external returns (uint256);

    /**
     * @dev Update an existing staking plan.
     * @param planId Unique ID of the staking plan.
     * @param duration Duration of the staking plan (in seconds).
     * @param apy Annual Percentage Rate of the staking plan.
     */
    function updateStakingPlan(uint256 planId, uint256 duration, uint16 apy) external;

    /**
     * @dev Remove an existing staking plan.
     * @param planId Unique ID of the staking plan.
     */
    function removeStakingPlan(uint256 planId) external;

    /**
     * @dev Enable withdrawals.
     */
    function enableWithdraw() external;

    /**
     * @dev Disable withdrawals.
     */
    function disableWithdraw() external;

    /**
     * @dev Set the minimum and maximum stake.
     * @param minimumStake Minimum stake.
     * @param maximumStake Maximum stake.
     */
    function setStakingLimits(uint256 minimumStake, uint256 maximumStake) external;

    /**
     * @dev Set the minimum stake.
     * @param minimumStake Minimum stake.
     */
    function setMininumStake(uint256 minimumStake) external;

    /**
     * @dev Set the maximum stake.
     * @param maximumStake Maximum stake.
     */
    function setMaximumStake(uint256 maximumStake) external;

    /**
     * @dev Reverts if the staking plan does not exist.
     * @param planId Unique ID of the staking plan.
     */
    function checkStakingPlanExists(uint256 planId) external view;

    /**
     * @dev Get staking token
     * @return Address of the staking token.
     */
    function getStakingToken() external view returns (address);

    /**
     * @dev Get a staking plan.
     * @param planId Unique ID of the staking plan.
     * @return Staking plan data.
     */
    function getStakingPlan(uint256 planId) external view returns (StakingPlan memory);

    /**
     * @dev Get all staking plans.
     * @param offset Offset of the staking plans.
     * @return Array of staking plans.
     */
    function getStakingPlans(uint256 offset, uint256 limit) external view returns (StakingPlan[] memory);

    /**
     * @dev Check if withdrawals are enabled.
     */
    function isWithdrawEnabled() external view returns (bool);

    /**
     * @dev Get the minimum and maximum stake.
     * @return minimumStake Minimum stake.
     * @return maximumStake Maximum stake.
     */
    function getStakingLimits() external view returns (uint256 minimumStake, uint256 maximumStake);

    /**
     * @dev Get the minimum stake.
     * @return minimumStake Minimum stake.
     */
    function getMinimumStake() external view returns (uint256);

    /**
     * @dev Get the maximum stake.
     * @return maximumStake Maximum stake.
     */
    function getMaximumStake() external view returns (uint256);
}
