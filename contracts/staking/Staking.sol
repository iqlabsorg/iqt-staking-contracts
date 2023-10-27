// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/Context.sol";

import {IStakingManagement} from "../staking-management/IStakingManagement.sol";
import {Constants} from "../library/Constants.sol";
import {IStaking} from "./IStaking.sol";

contract Staking is IStaking, Context {
    using EnumerableSet for EnumerableSet.UintSet;

    /**
     * @dev Staking token (IQT).
     */
    IERC20 internal _stakingToken;

    /**
     * @dev IStakingManagement instance
     */
    IStakingManagement internal _stakingManagement;

    /**
     * @dev User stakes data.
     */
    mapping(address => EnumerableSet.UintSet) private _userStakes;

    /**
     * @dev Mapping from stakeId => Stake
     */
    mapping(uint256 => Stake) private _stakes;

    /**
     * @dev All stakes IDs.
     */
    EnumerableSet.UintSet private _allStakeIds;

    /**
     * @dev Reverts if the stake does not exist.
     * @param stakeId Unique stake ID.
     */
    modifier onlyExistingStake(uint256 stakeId) {
        if (!_isStakeExists(stakeId)) revert StakeDoesNotExist(stakeId);
        _;
    }

    /**
     * @dev Reverts if the caller is not the stake owner.
     * @param stakeId Unique stake ID
     */
    modifier onlyStakeOwner(uint256 stakeId) {
        if (_msgSender() != _stakes[stakeId].staker) revert CallerIsNotStakeOwner(stakeId);
        _;
    }

    /**
     * @dev Reverts if the withdrawal is not enabled.
     */
    modifier withdrawEnabled() {
        if (!_stakingManagement.isWithdrawEnabled()) revert WithdrawalNotEnabled();
        _;
    }

    /**
     * @dev Constructor.
     * @param stakingManagement Address of the staking management contract.
     */
    constructor(address stakingManagement) {
        _stakingManagement = IStakingManagement(stakingManagement);
        _stakingToken = IERC20(_stakingManagement.getStakingToken());
    }

    /**
     * @inheritdoc IStaking
     */
    function stake(uint256 amount, uint256 stakingPlan) external override returns (uint256) {
        _stakingManagement.checkStakingPlanExists(stakingPlan);

        uint256 stakeId = _allStakeIds.length();
        _userStakes[_msgSender()].add(stakeId);
        _allStakeIds.add(stakeId);
        _stakes[stakeId] = Stake({
            staker: _msgSender(),
            amount: amount,
            stakingPlanId: stakingPlan,
            startTimestamp: block.timestamp,
            endTimestamp: block.timestamp + Constants.SECONDS_IN_DAY,
            earningsInTokens: 0,
            earningsPercentage: 0,
            withdrawn: false
        });

        _stakingToken.transferFrom(_msgSender(), address(this), amount);

        emit StakeAdded(_msgSender(), stakeId);

        return stakeId;
    }

    /**
     * @inheritdoc IStaking
     */
    function withdraw(
        uint256 stakeId
    ) external override onlyStakeOwner(stakeId) onlyExistingStake(stakeId) withdrawEnabled {
        if (!_stakes[stakeId].withdrawn) revert StakeAlreadyWithdrawn(stakeId);
        if (block.timestamp >= _stakes[stakeId].endTimestamp) revert StakeNotYetEnded(stakeId);

        (_stakes[stakeId].earningsInTokens, _stakes[stakeId].earningsPercentage) = calculateStakeEarnings(stakeId);
        _stakes[stakeId].withdrawn = true;
        _stakingToken.transfer(_msgSender(), _stakes[stakeId].amount + _stakes[stakeId].earningsInTokens);

        emit StakeWithdrawn(_msgSender(), stakeId);

        _userStakes[_msgSender()].remove(stakeId);
        _allStakeIds.remove(stakeId);
    }

    /**
     * @inheritdoc IStaking
     */
    function getStake(uint256 stakeId) external view override onlyExistingStake(stakeId) returns (Stake memory) {
        return _stakes[stakeId];
    }

    /**
     * @inheritdoc IStaking
     */
    function calculateStakeEarnings(
        uint256 stakeId
    ) public view override onlyExistingStake(stakeId) returns (uint256 earningsInTokens, uint16 earningsPercentage) {
        Stake memory stakeRecord = _stakes[stakeId];
        IStakingManagement.StakingPlan memory plan = _stakingManagement.getStakingPlan(stakeRecord.stakingPlanId);

        uint256 timeFractionOfYear = plan.duration / Constants.SECONDS_IN_YEAR;
        earningsInTokens = ((stakeRecord.amount * plan.apy) / Constants.MAX_APY) * timeFractionOfYear;
        earningsPercentage = uint16((earningsInTokens * Constants.MAX_APY) / stakeRecord.amount);

        return (earningsInTokens, earningsPercentage);
    }

    /**
     * @inheritdoc IStaking
     */
    function getStakes(address staker, uint256 offset, uint256 limit) external view override returns (Stake[] memory) {
        uint256 stakeCount = _userStakes[staker].length();
        if (offset >= stakeCount) {
            return new Stake[](0);
        }

        if (offset + limit > stakeCount) {
            limit = stakeCount - offset;
        }

        Stake[] memory stakes = new Stake[](limit);
        for (uint256 i = 0; i < limit; i++) {
            uint256 stakeId = _userStakes[staker].at(offset + i);
            stakes[i] = _stakes[stakeId];
        }

        return stakes;
    }

    /**
     * @inheritdoc IStaking
     */
    function getStakeIds(address staker) external view override returns (uint256[] memory) {
        return _userStakes[staker].values();
    }

    /**
     * @inheritdoc IStaking
     */
    function calculateTotalEarnings(
        address staker
    ) external view returns (uint256 totalEarningsInTokens, uint16 totalEarningsPercentage) {
        uint256[] memory stakeIds = _userStakes[staker].values();
        totalEarningsInTokens = 0;
        uint256 totalStakedAmount = 0;

        for (uint256 i = 0; i < stakeIds.length; i++) {
            (uint256 earningsInTokens, ) = calculateStakeEarnings(stakeIds[i]);
            totalEarningsInTokens += earningsInTokens;

            Stake memory stakeRecord = _stakes[stakeIds[i]];
            totalStakedAmount += stakeRecord.amount;
        }

        if (totalStakedAmount > 0) {
            totalEarningsPercentage = uint16((totalEarningsInTokens * Constants.MAX_APY) / totalStakedAmount);
        } else {
            totalEarningsPercentage = 0;
        }

        return (totalEarningsInTokens, totalEarningsPercentage);
    }

    /**
     * @inheritdoc IStaking
     */
    function isStakeExists(uint256 stakeId) external view override returns (bool) {
        return _isStakeExists(stakeId);
    }

    /**
     * @dev Returns `true` if a stake exists.
     * @param stakeId Unique ID of the stake.
     */
    function _isStakeExists(uint256 stakeId) internal view returns (bool) {
        return _allStakeIds.contains(stakeId);
    }
}
