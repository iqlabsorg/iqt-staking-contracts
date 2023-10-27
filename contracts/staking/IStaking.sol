// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

interface IStaking {
    /**
     * @dev Reverts if `caller` is not a stake owner.
     * @param stakeId Unique stake ID.
     */
    error CallerIsNotStakeOwner(uint256 stakeId);

    /**
     * @dev Reverts if the withdrawal is not enabled.
     */
    error WithdrawalNotEnabled();

    /**
     * @dev Reverts if the stake does not exist.
     * @param stakeId Unique stake ID.
     */
    error StakeDoesNotExist(uint256 stakeId);

    /**
     * @dev Reverts if the stake has already been withdrawn.
     * @param stakeId Unique stake ID.
     */
    error StakeAlreadyWithdrawn(uint256 stakeId);

    /**
     * @dev Reverts if the stake has not yet ended.
     * @param stakeId Unique stake ID.
     */
    error StakeNotYetEnded(uint256 stakeId);

    /**
     * @dev Emitted when a stake is added.
     * @param staker Address of the staker.
     * @param stakeId Unique ID of the stake.
     */
    event StakeAdded(address indexed staker, uint256 indexed stakeId);

    /**
     * @dev Emitted when a stake is withdrawn.
     * @param staker Address of the staker.
     * @param stakeId Unique ID of the stake.
     */
    event StakeWithdrawn(address indexed staker, uint256 indexed stakeId);

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
        address staker;
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
    function stake(uint256 amount, uint256 stakingPlan) external returns (uint256);

    /**
     * @dev Withdraw stake from the staking pool.
     * @param stakeId Unique ID of the stake.
     */
    function withdraw(uint256 stakeId) external;

    /**
     * @dev Calculate the earnings in tokens and percentages.
     * @param stakeId Unique ID of the stake.
     * @return earningsInTokens Amount of tokens earned.
     * @return earningsPercentage Percentage of tokens earned.
     */
    function calculateStakeEarnings(
        uint256 stakeId
    ) external view returns (uint256 earningsInTokens, uint16 earningsPercentage);

    /**
     * @dev Calculate the amount of tokens earned for a stake.
     * @param stakeId Unique ID of the stake.
     * @return Amount of tokens earned.
     */
    function getStake(uint256 stakeId) external view returns (Stake memory);

    /**
     * @dev Get all stakes data.
     * @param staker Address of the staker.
     * @param offset Offset of the stakes.
     * @param limit Limit of the stakes.
     * @return Array of stakes.
     */
    function getStakes(address staker, uint256 offset, uint256 limit) external view returns (Stake[] memory);

    /**
     * @dev Get all stakes data.
     * @param staker Address of the staker.
     * @return Array of stakes.
     */
    function getStakeIds(address staker) external view returns (uint256[] memory);

    /**
     * @dev Returns `true` if a stake exists.
     * @param stakeId Unique ID of the stake.
     */
    function isStakeExists(uint256 stakeId) external view returns (bool);

    /**
     * @dev Calculate the total earnings in tokens and percentages.
     */
    function calculateTotalEarnings(
        address staker
    ) external view returns (uint256 totalEarningsInTokens, uint16 totalEarningsPercentage);
}
