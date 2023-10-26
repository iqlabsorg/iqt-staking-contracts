// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

interface IStakerData {
    /**
     * @dev Stake data.
     * @param amount Amount of tokens staked.
     * @param stakingPlanId Index of the staking plan.
     * @param startTimestamp Timestamp when the stake was created.
     * @param endTimestamp Timestamp when the stake will end.
     * @param earningsInTokens Amount of tokens earned (calculated after withdraw).
     * @param earningsPercentage Percentage of tokens earned (calculated after withdraw).
     * @param withdrawn Whether the stake has been withdrawn.
     */
    struct Stake {
        uint256 amount;
        uint256 stakingPlanId;
        uint256 startTimestamp;
        uint256 endTimestamp;
        uint256 earningsInTokens;
        uint256 earningsPercentage;
        bool withdrawn;
    }

    /**
     * @dev Stake `amount` tokens for `stakingPlan` period.
     * @param amount Amount of tokens to stake.
     * @param stakingPlan Index of the staking plan to stake for.
     * @return Unique ID of the stake.
     */
    function stake(uint256 amount, uint256 stakingPlan) external returns(uint256);

    /**
     * @dev Withdraw stake from the staking pool.
     * @param stakeId Unique ID of the stake.
     */
    function withdraw(uint256 stakeId) external;

    /**
     * @dev Calculate the amount of tokens earned for a stake.
     * @param staker Address of the staker.
     * @param stakeId Unique ID of the stake.
     * @return Amount of tokens earned.
     */
    function getStake(address staker, uint256 stakeId) external view returns (Stake memory);

    /**
     * @dev Calculate the earnings in tokens and percentages.
     * @param staker Address of the staker.
     * @param stakeId Unique ID of the stake.
     * @return earningsInTokens Amount of tokens earned.
     * @return earningsPercentage Percentage of tokens earned.
     */
    function calculateStakeEarnings(address staker, uint256 stakeId) external view returns(
        uint256 earningsInTokens, uint256 earningsPercentage
    );

    /**
     * @dev Get all stakes data.
     * @param staker Address of the staker.
     * @return Array of stakes.
     */
    function getAllStakes(address staker) external view returns (Stake[] memory);

    /**
     * @dev Calculate the total earnings in tokens and percentages.
    */
    function calculateTotalEarnings(address staker) external view returns (
        uint256 totalEarningsInTokens,
        uint256 totalEarningsPercentage
    );
}