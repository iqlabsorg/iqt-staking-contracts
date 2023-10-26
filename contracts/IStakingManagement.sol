// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

interface IStakingControl {
    /**
     * @dev Staking plan data.
     * @param duration Duration of the staking plan (in seconds).
     * @param apr Annual Percentage Rate of the staking plan.
     */
    struct StakingPlan {
        uint256 duration;
        uint256 apr;
    }

    /**
     * @dev Add a new staking plan.
     * @param duration Duration of the staking plan (in seconds).
     * @param apr Annual Percentage Rate of the staking plan.
     * @return Unique ID of the staking plan.
     */
    function addStakingPlan(uint256 duration, uint256 apr) external returns(uint256);

    /**
     * @dev Update an existing staking plan.
     * @param planId Unique ID of the staking plan.
     * @param duration Duration of the staking plan (in seconds).
     * @param apr Annual Percentage Rate of the staking plan.
    */
    function updateStakingPlan(uint256 planId, uint256 duration, uint256 apr) external;

    /**
     * @dev Get a staking plan.
     * @param planId Unique ID of the staking plan.
     * @return Staking plan data.
     */
    function getStakingPlan(uint256 planId) external view returns (StakingPlan memory);

    /**
     * @dev Get all staking plans.
     * @return Array of staking plans.
     */
    function getStakingPlans() external view returns (StakingPlan[] memory);
}